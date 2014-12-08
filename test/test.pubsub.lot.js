

var onnex = require("..");
var crypto = require("crypto");

require('should');


var onnexServer = onnex.create();

var onnexClient = onnex.create();

onnexServer.publish("msg");

onnexServer.addBind({ host: process.env.IP , port: process.env.PORT } ,function(server){
    
    
    onnexClient.addConnect({ host: process.env.IP , port: process.env.PORT , alwaysConnect: true },function(){
        
        var count = 0 , equal ;
        
        onnexClient.subscribe("msg",function(msg){
            msg.should.eql(equal);
            next();
        });
        
        
        function next(){
            if(count++ > 1000){
                onnexServer.closeAll();
                onnexClient.closeAll();
                return;
            }
            
            var longBuffer = crypto.randomBytes(100);
            equal = longBuffer.toString('base64');
            onnexServer.publish("msg",equal);
        }
        next();
    });

});
