

var onnex = require("..");

var async = require("async");

require('should');


var onnexServer = onnex.create();



onnexServer.publish("msg");

onnexServer.addBind({ host: process.env.IP , port: process.env.PORT } ,function(server){
    
    var count = 0;

    var times = 100;

    async.times(times, function(n,next){
        
        
        var onnexClient = onnex.create();
            
        onnexClient.addConnect({ host: process.env.IP , port: process.env.PORT , alwaysConnect: true },function(){

            onnexClient.subscribe("msg",function(msg){
                msg.should.equal('hello');
                count++;
                onnexClient.closeAll();
            });
            
            next();
        });
    },function(){
        
        onnexServer.publish("msg",'hello');
        
        
        setTimeout(function() {
            count.should.equal(times);
            
            onnexServer.closeAll();
        },1000);
         
    });
    
    

});
