
var onnex = require("..");

require('should');


var onnexServer = onnex.create();
onnexServer.addFunction("multi" ,function( a  , b  ){
    var cb = Array.prototype.slice.call(arguments).pop();
    setTimeout(function() {
              cb(null,  a * b );
    }, 500);

});
onnexServer.addBind({ host: process.env.IP , port: process.env.PORT },function(){
    
    var n =2;
    
    var onnexClient = onnex.create();
    onnexClient.addConnect({ host: process.env.IP , port: process.env.PORT , alwaysConnect: true });
    onnexClient.options.timeout = 300; 
    onnexClient.callFunction("multi", 2 , 3  , function(err, data ){
        err.message.should.equal("TIMEOUT");
        onnexClient.closeAll();
        if(--n===0) onnexServer.closeAll();
    });
    
    
    var onnexClient2 = onnex.create();
    onnexClient2.addConnect({ host: process.env.IP , port: process.env.PORT , alwaysConnect: true });
    onnexClient2.options.timeout = 3000; 
    onnexClient2.callFunction("multi", 2 , 3  , function(err, data ){
        data.should.equal(2*3);
        onnexClient2.closeAll();
        if(--n===0) onnexServer.closeAll();
    });
    
});

