
var net = require("net");
var tls = require('tls');
var util = require('util');
var stream = require('stream');
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

    this.options = options | {};
    this.options.retry = 2000;
    this.servers = [];
    this.sockets = [];
    this.socketDefault = false;

    this.functions = {};
    this.publishs = {};
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

onnex.prototype.addConnect = function( options , cb ){ //
    var _this = this;
    var socket = ( options.tls ?  tls : net ).createConnection( options , cb );


    this.sockets.push(socket);
    this._socketEvents(socket);

    socket.on("error",function(err){
        
        if(_this.options.retry && ~ignore.indexOf(err.code))
        {
                setTimeout(function(){
                    _this.addConnect( options , cb);
                }, _this.options.retry);
        }
    });
    return socket;

};

onnex.prototype.end = function(){

    for(var i in this.servers) this.servers[i].close();
    for( i in this.sockets) this.sockets[i].end();

};

onnex.prototype._socketEvents = function( socket ){

    if(!this.socketDefault) this.socketDefault = socket;
    
    socket.callbacks = {};
    socket.subscribes = {};
    socket.publishs = {};
    
    var _lastId = 0;
    
    var _this = this;

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
                name =  p.buffer.toString("utf8", 4 ,nameEnd )
                args = {};

                try{
                     args = JSON.parse( p.buffer.toString("utf8", nameEnd + 2 ) );
                }catch(e){}
                
        
                if(_this.functions.hasOwnProperty(name)){
                    args.push(function(){ socket.callCallback( callbackId, Array.prototype.slice.call(arguments));  });
                    
                    _this.functions[name].apply(null,args);
                    
                }else{
                      socket.callCallback( callbackId, [{ code: "NOTFOUNDFUNCTION" }]);
                }
                    
                break;
            case 1: //call callback
                
                callbackId = p.buffer.readUInt32LE(0).toString(36);
                args = {};
                try{
                     args = JSON.parse( p.buffer.toString("utf8", 5 ) );
                }catch(e){}
                
               
                if(socket.callbacks.hasOwnProperty(callbackId)) 
                {
                    socket.callbacks[callbackId].apply(null,args);
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
                        socket.subscribes[name][i].apply(null,args);
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

        var buff = new Buffer( 4 + nameBuffer.length + 1 + 1 + argsBuffer.length);

        buff.writeUInt32LE( socket.addCallback(callback) || 0 , 0 );
        nameBuffer.copy(buff, 4);
        buff[ nameBuffer.length + 4 ] = 0xff;
        buff[ nameBuffer.length + 5 ] = 0x1;
        argsBuffer.copy(buff, nameBuffer.length + 6 );

        socket.sendPackage(buff , -1);
    };
    
    socket.callCallback = function( id , args ){
      
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
      
        if(socket.subscribes.hasOwnProperty(name))
            socket.subscribes[name].push(fn);
        else
            socket.subscribes[name] = [fn];
            
        var nameBuffer = new Buffer( name );
        socket.sendPackage( nameBuffer , -2);
        
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


    socket.on('end', function(){
        _this.sockets.splice( _this.sockets.indexOf(socket) , 1 );
    });

};



onnex.prototype.addFunction = function( name , fn ){
        this.functions[name] = fn;
};
    

onnex.prototype.subscribe = function( name  ){
     for(var i in this.sockets)
        this.sockets[i].subscribe( name );
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
