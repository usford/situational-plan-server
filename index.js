import WebSocket from 'ws';
import { exec, spawn } from 'child_process';

const WebSocketPort = 7777;

const wss = new WebSocket.Server({port: WebSocketPort});

wss.on('connection', function connection(ws){
    console.log("Browser is connected");

    // console.log("Запуск ТП-44");

    // exec('"List_TP/TP44/start.bat"', (err, stdout, stderr) => {
    //     if (err) {
    //         console.error(err);
    //         return;
    //     }
    //     console.log(stdout);
    //     });

    ws.on('message', function incoming(message)
    {
        console.log('Message: ' + message);
        var event = JSON.parse(message);

        if (event.type == "pressedButton")
        {
            if (event.id == "1kn00-004.1")
            {
                
            }

            //Выход
            if (event.id == "1kn00-016.1")
            {
                exec('kill.bat', (err, stdout, stderr) => {
                if (err) {
                    console.error(err);
                    return;
                }
                console.log(stdout);
                });
                //process.exit(1);
                setTimeout(() => {
                    process.exit(1)
                }, 1000);
            }
        }

    });
}).on('close', function () {
    console.log("WS CLOSED")
});