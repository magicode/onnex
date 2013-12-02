
var onnex = require("..");

require('should');

var n =3;
var onnexServer = onnex.create();
onnexServer.addFunction("multi" ,function( a  , b  ){
    var cb = Array.prototype.slice.call(arguments).pop();
    cb(null,  a * b );
});


var onnexClient = onnex.create();
onnexClient.addConnect({ host: process.env.IP , port: process.env.PORT , alwaysConnect: true });
onnexClient.callFunction("multi", 2 , 3  , function(err, data ){
    data.should.equal(2*3);
    onnexClient.closeAll();
    if(--n===0) onnexServer.closeAll();
});


var onnexClient2 = onnex.create();
onnexClient2.addConnect({ host: process.env.IP , port: process.env.PORT , alwaysConnect: true });
onnexClient2.options.timeoutWrite = 3000; 
onnexClient2.callFunction("multi", 2 , 3  , function(err, data ){
    data.should.equal(2*3);
    onnexClient2.closeAll();
    if(--n===0) onnexServer.closeAll();
});

var onnexClient3 = onnex.create();
onnexClient3.addConnect({ host: process.env.IP , port: process.env.PORT , alwaysConnect: true });
onnexClient3.options.timeoutWrite = 100; 
onnexClient3.callFunction("multi", 2 , 3  , function(err, data ){
    err.message.should.equal("TIMEOUT");
    onnexClient3.closeAll();
    if(--n===0) onnexServer.closeAll();
});

setTimeout(function() {
         onnexServer.addBind({ host: process.env.IP , port: process.env.PORT });
}, 2000);
