

var onnex = require("..");

require('should');


var onnexServer = onnex.create();

var onnexClient = onnex.create();

onnexServer.publish("msg");

onnexServer.addBind({ host: process.env.IP , port: process.env.PORT } ,function(server){
    
    
    onnexClient.addConnect({ host: process.env.IP , port: process.env.PORT , alwaysConnect: true },function(){
        
        var n = 0 ;
        
        onnexClient.subscribe("msg",function(msg){
            
            switch(n){
                
                case 0:
                    msg.should.eql({ name: 'foo' });
                    break;
                case 1:
                    msg.should.eql('boo');
                    onnexServer.closeAll();
                    onnexClient.closeAll();
                    break;
            }
            n++;
           
        });
        
        onnexServer.publish("msg",{ name: 'foo' });
        onnexServer.publish("msg",'boo');
    });

});
