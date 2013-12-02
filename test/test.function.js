
var onnex = require("..");

require('should');


var onnexServer = onnex.create();

var onnexClient = onnex.create();

onnexServer.addFunction("multi" ,function( a  , b  ){
    var cb = Array.prototype.slice.call(arguments).pop();
    cb(null,  a * b );
});

onnexServer.addBind({ host: process.env.IP , port: process.env.PORT } ,function(server){
    
    
    onnexClient.addConnect({ host: process.env.IP , port: process.env.PORT , alwaysConnect: true },function(){
        
        onnexClient.callFunction("multi", 2 , 3  , function(err, data ){
                data.should.equal(2*3);
                onnexServer.closeAll();
                onnexClient.closeAll();
        });
        
    });

});
