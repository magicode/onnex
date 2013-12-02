
var net = require("net");
var tls = require('tls');
var util = require('util');
var EventEmitter = require('events').EventEmitter;



if(!Buffer.prototype.writeUInt24LE)
Buffer.prototype.writeUInt24LE = function( value ,offset){
        this[offset + 2] = (value & 0xff0000) >>> 16;
        this[offset + 1] = (value & 0x00ff00) >>> 8;
        this[offset] = value & 0x0000ff;
};

if(!Buffer.prototype.readUInt24LE)
Buffer.prototype.readUInt24LE = function( offset ){
    return  (this[offset + 2] << 16) | (this[offset + 1] << 8) | (this[offset]);
};

function onnex( options ){

    this.options = options || {};
    
    var defaultOptions = { retry: 500 , timeout: 0 , timeoutWrite: 0 };
    
    for(var key in defaultOptions)
        if(!(key in this.options)) this.options[key] = defaultOptions[key];
    
    this.servers = [];
    this.sockets = [];
    this._socketDefault = false;

    this.functions = {};
    this.publishs = {};
    
    
    Object.defineProperty(this, "socketDefault",
    {
        get : function () {  
            
            if( this._socketDefault instanceof net.Socket &&  this._socketDefault.writable && this._socketDefault.readable) return this._socketDefault ;
            
            for(var i in this.sockets)
                if( this.sockets[i] instanceof net.Socket && this.sockets[i].writable && this.sockets[i].readable) return  this._socketDefault = this.sockets[i];
            
            return this._socketDefault || this.sockets[0] || false;
        }
    });

}

util.inherits( onnex , EventEmitter );


onnex.prototype.addBind = function( options , cb ){

    var server ;
    var _this = this;

    if(options.tls){
        server = tls.createServer( options );
    }else{
        server = net.createServer();
    }


    this.servers.push( server );

    server.on('connection',function(socket){
        socket._noReconnect = true;
        _this.sockets.push(socket);
        _this._socketEvents(socket);
        _this.emit('connection',socket );
        
    });

    server.on("close",function(){
        _this.servers.splice(_this.servers.indexOf(server), 1);
    });


    server.listen.apply(server, options.path ? [ options.path ,cb ] : [options.port , options.host ,cb]);

};

var ignore = [
              'ECONNREFUSED',
              'ECONNRESET',
              'ETIMEDOUT',
              'EHOSTUNREACH',
              'ENETUNREACH',
              'ENETDOWN',
              'EPIPE'
            ];

onnex.prototype.addConnect = function( options , cb ){ 
    
    var socket = ( options.tls ?  tls : net ).createConnection( options , cb );


    this.sockets.push(socket);
    this._socketEvents(socket , options , cb );

    this.emit("connect" , socket );
    
    return socket;


};




onnex.prototype.end =  onnex.prototype.closeAll = function(){

    for(var i in this.servers) this.servers[i].close();
    for( i in this.sockets) {
        this.sockets[i]._noReconnect = true;
        this.sockets[i].end();
        this.sockets[i].destroy();
    }
 
};

onnex.prototype._socketEvents = function( socket ,options , cb){
    
    var _this = this;
    
    socket.callbacks = {};
    socket.subscribes = {};
    socket.publishs = {};
    
    /*
    var oldEnd = socket.end ;
    socket.end = function(){
        
        oldEnd.apply(this,arguments);
    };
    */
    
    
    
    socket.reconnectCount = 0;
    var reconnectNow = false;
    socket.reconnect = function(){
	
        if(reconnectNow ||  socket._noReconnect) return;
        reconnectNow = true;
        setTimeout(function(){
            socket.reconnectCount++;
            //console.log("reconnect %d",socket.reconnectCount);
            _this.emit("reconnect",socket);
            socket.connect( options );
            reconnectNow = false;
        }, _this.options.retry);
    };
    
    
    
    
    var _lastId = 0;
    
    

    var p = {};
    var dataLeft = {};

    socket.on("data" , function(data){
        
        //console.log(data.toString());
        
        if(dataLeft.length){
            var dataTmp = new Buffer( dataLeft.length + data.length );
            dataLeft.copy( dataTmp );
            data.copy( dataTmp , dataLeft.length );
            data = dataTmp;
            dataLeft = {};
        }

        var posRead = 0;
        while( posRead < data.length){

            if( !p.subId )
            {
                if( data.length - posRead < 10 ){
                    dataLeft =  new Buffer( data.length - posRead );
                    data.copy( dataLeft , 0 , posRead );
                    break;
                }
                
                // meta |  length   |  type  |  reserved | data
                //  00    XX XX XX      XX      00 00 00    00
                
                p.meta = data.readInt8( posRead++ );
                if(p.meta !== 0)  continue;
                p.length = data.readUInt24LE( posRead );
                p.type = data.readInt8(posRead += 3);
                
                posRead += 4;
                p.buffer = new Buffer(p.length);
                p.pos = 0;
            }
            
            
            p.leftRead = ( p.length - p.pos );
            
            var leftRead = (data.length - posRead);
            var sizeToCopy = (p.leftRead > leftRead) ? leftRead : p.leftRead;

            data.copy( p.buffer , p.pos , posRead , posRead + sizeToCopy);
      
            posRead += sizeToCopy;
            p.pos += sizeToCopy;


            if(p.pos == p.length){
                socket.onPackage(p);
                p = {};
            } 
        }

    });


    socket.onPackage = function( p ){
     
        var args , name , callbackId ,nameEnd ,i;
        switch (p.type) {
            case -1: //call function
                
                //   0 - 3        4 - [] == 0xff     +1 - +1       +1 - end
                // callbackId     name               flag     dataJson
                nameEnd = 4;
                for( ;nameEnd < p.buffer.length ; nameEnd++ ) if(p.buffer[nameEnd] == 0xff) break;
                
                callbackId = p.buffer.readUInt32LE(0);
                name =  p.buffer.toString("utf8", 4 ,nameEnd );
                args = {};

                try{
                     args = JSON.parse( p.buffer.toString("utf8", nameEnd + 2 ) );
                }catch(e){}
                
        
                if(_this.functions.hasOwnProperty(name)){
                    args.push(function(){ socket.callCallback( callbackId, Array.prototype.slice.call(arguments));  });
                    
                    _this.functions[name].apply(socket,args);
                    
                }else{
                      socket.callCallback( callbackId, [new Error("NOTFOUNDFUNCTION")]);
                }
                    
                break;
            case 1: //call callback
                
                callbackId = p.buffer.readUInt32LE(0).toString(36);
                args = {};
                try{
                     args = JSON.parse( p.buffer.toString("utf8", 5 ) );

                }catch(e){}
                
                if(args[0] && args[0].$type == "error" && args[0].message)
                            args[0] = new Error(args[0].message);
                
                if(socket.callbacks.hasOwnProperty(callbackId)) 
                {
                    socket.callbacks[callbackId].apply(socket,args);
                    delete socket.callbacks[callbackId];
                }
                break;
            case -2: // subscribe
            case -3:

                name =  p.buffer.toString("utf8");
                
                
                if(_this.publishs.hasOwnProperty(name)){
                    if(p.type == -2) socket.publishs[name] = true;
                    else delete socket.publishs[name];
                }
                 
                 
                break;
            case 2: // publish
                
                 
                for(nameEnd = 0 ;nameEnd < p.buffer.length ; nameEnd++ ) if(p.buffer[nameEnd] == 0xff) break;

                name =  p.buffer.toString("utf8", 0 ,nameEnd );
                args = {};
                try{
                     args = JSON.parse( p.buffer.toString("utf8", nameEnd + 2 ) );
                }catch(e){}
                 
                if( socket.subscribes.hasOwnProperty(name) )
                {
                    for(i in socket.subscribes[name])
                    {
                        socket.subscribes[name][i].apply(socket,args);
                    }
                }
                break;
            
            default:
                break;
        }
        
    };
    

    
    socket.addCallback = function( callback ){
        if("function" != typeof callback) return callback;
        for(var i in socket.callbacks) if(socket.callbacks[i] == callback) return parseInt( i, 36);
        while(socket.callbacks.hasOwnProperty( ( _lastId = (++_lastId) % 0xffffff ).toString(36) ) );
        
        socket.callbacks[ _lastId.toString(36) ] = callback;
        
        return _lastId;
    };

    socket.callFunction = function( name ){
        
        var args = Array.prototype.slice.call(arguments);
        
        args.splice(0, 1);  
        var callback = args.pop();
        if("function" !== typeof callback) return false;
        
        var nameBuffer = new Buffer( name );
        var argsBuffer = new Buffer(JSON.stringify(args));

        var timeout;
        if(_this.options.timeout > 0 && 'number' == typeof _this.options.timeout)
            timeout = setTimeout(function() {
                callback(new Error("TIMEOUT"));
                callback  = function(){};
            }, _this.options.timeout );

        var buff = new Buffer( 4 + nameBuffer.length + 1 + 1 + argsBuffer.length);
        buff.writeUInt32LE( socket.addCallback(function(){
            clearTimeout(timeout);
            callback.apply(socket,arguments);
            //socket.removeListener('reconnect', recall);
        }) || 0 , 0 );
        nameBuffer.copy(buff, 4);
        buff[ nameBuffer.length + 4 ] = 0xff;
        buff[ nameBuffer.length + 5 ] = 0x1;
        argsBuffer.copy(buff, nameBuffer.length + 6 );
        
    
        if( socket.writable && socket.readable && !_this.options.timeoutWrite){
              socket.sendPackage(buff , -1);
        }else{
            var timeoutWrite;
            timeoutWrite = setTimeout(function() {
                callback(new Error("TIMEOUT"));
                callback  = function(){};
            }, _this.options.timeoutWrite );
            socket.once("connect",function(){
                clearTimeout(timeoutWrite);
                socket.sendPackage(buff , -1);
            });
        }
    };
    
    socket.callCallback = function( id , args ){
      
        if(args[0] && args[0] instanceof Error)
            args[0] = { $type: "error" , message: args[0].message };
            
     
        var argsBuffer = new Buffer( JSON.stringify(args) );
        
        var buff = new Buffer(4 + 1 + argsBuffer.length );
        buff.writeUInt32LE( id , 0 );
        buff[ 4 ] = 0x1;
        argsBuffer.copy(buff, 5 );
        
        socket.sendPackage(buff , 1);
        
    };


    socket.unSubscribe = function( name , fn ){
      
        if(!socket.subscribes.hasOwnProperty(name)) return;
        
        if(fn)
            socket.subscribes[name].slice(socket.subscribes[name].indexOf(fn),1);
        
        if(socket.subscribes[name].length) return;
        
        var nameBuffer = new Buffer( name );
        socket.sendPackage( nameBuffer , -3);
        
    };

    socket.subscribe = function( name , fn ){
      
        var reargs = arguments;
        var recall = function(resocket){ resocket.subscribe.apply(socket,reargs); };
         
        if(socket.subscribes.hasOwnProperty(name))
            socket.subscribes[name].push(fn);
        else
            socket.subscribes[name] = [fn];
            
        var nameBuffer = new Buffer( name );
        socket.sendPackage( nameBuffer , -2);
        
        socket.once('reconnect', recall);
    };
    
    socket.publish = function( name ){
        
        if(!_this.publishs.hasOwnProperty(name)) return;
        
        var args = Array.prototype.slice.call(arguments);
        args.splice(0, 1); 
        
        var nameBuffer = new Buffer( name );
        var argsBuffer = new Buffer( JSON.stringify(args) );
        
        var buff = new Buffer( nameBuffer.length + 1 + 1 + argsBuffer.length );
        
        nameBuffer.copy(buff, 0);
        buff[nameBuffer.length ]  = 0xff;
        buff[nameBuffer.length + 1]  = 0x01;
        argsBuffer.copy(buff, nameBuffer.length + 2);
        
        socket.sendPackage(buff , 2);
    };
    
    
    socket.sendPackage = function( buff , type ){
        var buffSend = new Buffer(buff.length + 8);

        // meta |  length   |  type  |  reserved | data
        //  00    XX XX XX      XX      00 00 00    00

        buffSend.writeInt8(0,0);
        buffSend.writeUInt24LE( buff.length ,1);
        buffSend.writeInt8(type,4);
        buffSend.writeUInt24LE( 0 ,5);

        //data
        buff.copy(buffSend, 8 );

        socket.write(buffSend);
    };

    socket.on("error",function(err){
        //console.log("[onnex] error");
        if(_this.options.retry && !!~ignore.indexOf(err.code))
        {
           socket.reconnect();
        }
    });
    socket.on('end', function(){
        //console.log("[onnex] end");
        if( options && options.alwaysConnect &&  !socket._noReconnect){
             socket.reconnect();
        }else{
            _this.sockets.splice( _this.sockets.indexOf(socket) , 1 );
        }
    });
    socket.on('close', function(){
        //console.log("[onnex] close");
        if( options && options.alwaysConnect &&  !socket._noReconnect){
             socket.reconnect();
        }else{
            _this.sockets.splice( _this.sockets.indexOf(socket) , 1 );
        }
    });
};


onnex.prototype.callFunction = function(){
    
    var cb = Array.prototype.slice.call(arguments).pop();
    if("function" !== typeof cb) return false;
    
    var socket = this.socketDefault;
    if(socket){
        socket.callFunction.apply(null, arguments);
        return true;
    } 
    cb(new Error("NOSOCKET"));
    return false ;
};

onnex.prototype.addFunction = function( name , fn ){
        this.functions[name] = fn;
};

onnex.prototype.subscribe = function(){    
     for(var i in this.sockets)
        this.sockets[i].subscribe.apply(null,arguments);
};

onnex.prototype.publish = function( name ){
    
    if(!this.publishs.hasOwnProperty(name))
    {
        this.publishs[name] = true;
        return;
    }
    
    for(var i in this.sockets)
        this.sockets[i].publish.apply(null,arguments);
    
};


exports.create = function( options ){
    return new onnex( options );
};

exports.Onnex = onnex;
