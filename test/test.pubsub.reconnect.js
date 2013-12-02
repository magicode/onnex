
var onnex = require("..");

require('should');


var onnexServer = onnex.create();

var onnexClient = onnex.create();

onnexServer.publish("pub");
onnexServer.addBind({ host: process.env.IP , port: process.env.PORT });

onnexClient.addConnect({ host: process.env.IP , port: process.env.PORT , alwaysConnect: true },function(){
    
    
    
    onnexClient.subscribe("pub",function(data){
            data.should.equal("foo");
            onnexServer.closeAll();
            onnexClient.closeAll();
    });
    
    
    //onnexServer.publish("pub","foo");
    onnexServer.closeAll();
    
    setTimeout(function() {
        onnexServer.addBind({ host: process.env.IP , port: process.env.PORT } );
        setTimeout(function() {
            onnexServer.publish("pub","foo");
        },1000);
    }, 20);
    
    
    
});





    
    
    
