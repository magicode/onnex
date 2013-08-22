
# Onnex

 rpc & subpub

## Installation

    $ npm install axon


## Exemple


```js




var onnex = require("./onnex");


var onnexServer = onnex.create();
var onnexClient = onnex.create();


onnexServer.addFunction("multi",function( a , b ){
    var cb = Array.prototype.slice.call(arguments).pop();
    cb(null,  a * b );
});

onnexServer.publish("time tick");

setInterval(function(){
    
    onnexServer.publish("time tick", new Date().getTime() );
    
} , 1000 );

onnexServer.addBind({ port: 8080 } ,function(server){
   
      
   var socket = onnexClient.addConnect({ port: 8080 }, function(){
    
     
        socket.subscribe("time tick",function( time ){
            console.log("time :" , new Date(time));
        });
        
        

        socket.callFunction("multi", 2 , 3  , function( err , result ){
            console.log("2 * 3 :" , result);
        });
        
        
        
    });
    
    
});


```