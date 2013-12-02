
var onnex = require("..");

require('should');


var onnexServer = onnex.create();

var onnexClient = onnex.create();


onnexServer.addBind({ host: process.env.IP , port: process.env.PORT } ,function(server){
    
    
    onnexClient.addConnect({ host: process.env.IP , port: process.env.PORT , alwaysConnect: true },function(){
        
        onnexClient.callFunction("multi", 2 , 3  , function(err, data ){
                err.message.should.eql('NOTFOUNDFUNCTION');
                onnexServer.closeAll();
                onnexClient.closeAll();
        });
        
    });

});
