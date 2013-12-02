
var onnex = require("..");

require('should');

var timeout = setTimeout(function() {}, 50000);
var timeout2 = setTimeout(function() {}, 50000);
var onnexServer = onnex.create();

var onnexClient = onnex.create();

onnexServer.addFunction("multi" ,function( a  , b  ){
    var cb = Array.prototype.slice.call(arguments).pop();
    cb(null,  a * b );
});

onnexClient.addConnect({ host: process.env.IP , port: process.env.PORT , alwaysConnect: true });

onnexClient.callFunction("multi", 2 , 3  , function(err, data ){
    data.should.equal(2*3);
    clearTimeout(timeout);
});


onnexServer.addBind({ host: process.env.IP , port: process.env.PORT } ,function(server){
    
    
    onnexServer.closeAll();
    
    onnexClient.callFunction("multi", 2 , 3  , function(err, data ){
                    data.should.equal(2*3);
                    clearTimeout(timeout2);
                    onnexServer.closeAll();
                    onnexClient.closeAll();
    });
    setTimeout(function() {
         onnexServer.addBind({ host: process.env.IP , port: process.env.PORT });
    }, 20);
   
    
});
