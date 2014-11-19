var onnex = require("..");


var crypto = require("crypto");
var async = require("async");


require('should');


var onnexServer = onnex.create();

var onnexClient = onnex.create();



onnexServer.addFunction("base64" ,function( str ){
    var cb = Array.prototype.slice.call(arguments).pop();
    
    cb(null, new Buffer(str,'hex').toString('base64') );
});

onnexServer.addBind({ host: process.env.IP , port: process.env.PORT } ,function(server){
    
    onnexClient.options.timeout = 1000;
    onnexClient.addConnect({ host: process.env.IP , port: process.env.PORT , alwaysConnect: true },function(){
        
        async.times(10, function(n,next){
            var longBuffer = crypto.randomBytes(10000);
            
            onnexClient.callFunction("base64", longBuffer.toString('hex')  , function(err, data ){
                data.should.equal(longBuffer.toString('base64'));
                next();
            });
        },function(){
            onnexServer.closeAll();
            onnexClient.closeAll();
        });
        
    });

});
