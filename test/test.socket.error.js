
var onnex = require("..");

require('should');


var onnexClient = onnex.create();



onnexClient.callFunction("multi", 2 , 3  , function(err, data ){
    err.message.should.eql('NOSOCKET');
    onnexClient.closeAll();
});
