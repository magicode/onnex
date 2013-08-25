# Onnex

 rpc & subpub

## Installation

    $ npm install onnex


## Example



### onnex A
be server

```js

var onnex = require("onnex");

var onnexA = onnex.create();

onnexA.addFunction("multi",function( a , b ){
    var cb = Array.prototype.slice.call(arguments).pop();
    cb(null,  a * b );
});

onnexA.publish("time tick");

setInterval(function(){
    onnexA.publish("time tick", new Date().getTime() );
} , 1000 );

onnexA.addBind({ port: 8080 });
```



### onnex B 
be client
```js
var onnex = require("onnex");

var onnexB = onnex.create();

onnexB.addConnect({ port: 8080 , alwaysConnect: true});
    
onnexB.subscribe("time tick",function( time ){
        console.log("time :" , new Date(time));
});
        
onnexB.callFunction("multi", 2 , 3  , function( err , result ){
        console.log("2 * 3 :" , result);
});
```
