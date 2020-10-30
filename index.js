import WebSocket from 'ws';
import { exec, spawn } from 'child_process';
import MySql from 'mysql2';
import XLSX from 'xlsx';

import ControllerInput from './models/contoller_input.js';

  

// Configuration excel files paths
const codesWorkbookPath = './config/codes_sp.xlsx';
const controllersWorkbookPath = './config/controllers.xlsx';
const connectionWorkbookPath = './config/connection.xlsx';

const WebSocketPort = 7777;

const wss = new WebSocket.Server({port: WebSocketPort});
wss.broadcast = function broadcast(msg) {
    wss.clients.forEach(function each(client) {
        client.send(msg);
    });
};

let codesWorkbook = XLSX.readFile(codesWorkbookPath);
let controllersWorkbook = XLSX.readFile(controllersWorkbookPath);
let connectionWorkbook = XLSX.readFile(connectionWorkbookPath);

console.log('\nЧтение конфигурации из файла ' + codesWorkbookPath);

let tables = parseTables(codesWorkbook.Sheets['Реестр таблиц конфигураций']);

///
/// Parse sheet "Логика алгоритмов изменения состояния линий уличного освещения на ситуационном плане"
///
console.log('\n\n**************************************************************************************');
console.log('Чтение конфигурации из таблицы "Логика алгоритмов изменения состояния линий уличного освещения на ситуационном плане"\n');
let logicLines = parseLogicLines(codesWorkbook.Sheets[tables['Логика алгоритмов изменения состояния линий уличного освещения на ситуационном плане']]);

console.log('\nЧтение конфигурации данных контроллера из файла ' + controllersWorkbookPath);
let controllerInputs = parseControllerInputs(controllersWorkbook.Sheets['Table1']);
let controllerOutputs = parseControllerInputs(controllersWorkbook.Sheets['Table2']);

let inputTableTimer;
// How often we read data from controller input table in milliseconds
let inputTableInterval = connectionWorkbook.Sheets['Подключения к базам данных']['B7'];

///
/// Connect to controllers MySql databse
///
let mySqlHost = connectionWorkbook.Sheets['Подключения к базам данных']['B2'];
let mySqlPort = connectionWorkbook.Sheets['Подключения к базам данных']['B3'];
let mySqlUser = connectionWorkbook.Sheets['Подключения к базам данных']['B4'];
let mySqlUserPassword = connectionWorkbook.Sheets['Подключения к базам данных']['B5'];
let mySqlDatabaseName = connectionWorkbook.Sheets['Подключения к базам данных']['B6'];

const mysqlConnection = MySql.createConnection({
    host: mySqlHost.w,
    port: mySqlPort.v,
    user: mySqlUser.w,
    password: mySqlUserPassword.w,
});

let activeLines = [];

//Чтение из БД
mysqlConnection.connect(function (err) {
    if (err) throw err;
    console.log("База данных MySql подключена. \nЗапуск таймера считывания состояния из базы данных...");
    // Set-up timer to read periodicaly
    inputTableTimer = setInterval(
        () => {
            mysqlConnection.query(`select * from ${mySqlDatabaseName.w}.table2`,
                function (err, results, fields) 
                {
                    if (err != null) 
                    {
                        console.log(err);
                    }
                    // Save controllerInputs in order to compare them after update
                    let oldControllerOutputs = controllerOutputs.map((controllerOutput) =>
                        ControllerInput.copyFrom(controllerOutput)
                    );
                    // Parse result and fill controllerInputs
                    let keys = Object.keys(results[0]);
                    keys.forEach(key => {
                        // Find input with key
                        let controllerOutput = controllerOutputs.find(controllerOutput => controllerOutput.item == key);
                        if (controllerOutput) {
                            // Get value and time from database
                            controllerOutput.value = results[0][`item${controllerOutput.id}`];
                            controllerOutput.time = results[0][`itime${controllerOutput.id}`];
                            //console.log(`${controllerInput.name.padEnd(20,' ')} ${controllerInput.time} ${controllerInput.value}`);
                        }
                    });

                });
            mysqlConnection.query(
                `select * from ${mySqlDatabaseName.w}.table1`,
                function (err, results, fields) {
                    if (err != null) {
                        console.log(err);
                    }

                    let curDate = new Date().toLocaleString();
                    console.log(`${curDate} Чтение информации из базы данных контроллера`);

                    // Save controllerInputs in order to compare them after update
                    let oldControllerInputs = controllerInputs.map((controllerInput) =>
                        ControllerInput.copyFrom(controllerInput)
                    );
                    // Parse result and fill controllerInputs
                    let keys = Object.keys(results[0]);
                    keys.forEach(key => {
                        // Find input with key
                        let controllerInput = controllerInputs.find(controllerInput => controllerInput.item == key);
                        if (controllerInput) {
                            // Get value and time from database
                            //console.log(results[0]);
                            controllerInput.value = results[0][`item${controllerInput.id}`];
                            controllerInput.time = results[0][`itime${controllerInput.id}`];

                            if (results[0][`U1`] != undefined)
                            {
                                controllerInput.value = results[0][`U1`]; 
                            }
                            if (results[0][`U2`] != undefined)
                            {
                                controllerInput.value = results[0][`U1`]; 
                            }
                            if (results[0][`U3`] != undefined)
                            {
                                controllerInput.value = results[0][`U1`]; 
                            }
                            if (results[0][`I1`] != undefined)
                            {
                                controllerInput.value = results[0][`I1`]; 
                            }
                            if (results[0][`I2`] != undefined)
                            {
                                controllerInput.value = results[0][`I2`]; 
                            }
                            if (results[0][`I3`] != undefined)
                            {
                                controllerInput.value = results[0][`I3`]; 
                            }
                            //console.log(`${controllerInput.name.padEnd(20,' ')} ${controllerInput.time} ${controllerInput.value}`);
                        }
                    });
                    // Check if we have changes with the previous result
                    controllerInputs.forEach(controllerInput => {
                        let oldControllerInput = oldControllerInputs.find(oldControllerInput => oldControllerInput.id == controllerInput.id);

                        if (!controllerInput.isEqual(oldControllerInput)) {
                            console.log(`Обновление данных:  ${controllerInput.item.padEnd(8, '')}  ${controllerInput.value}`);
                            // Get changed controller input
                            // var U1 = true;
                            // var U2 = true;
                            // var U3 = true;
                            // var I1 = true;
                            // var I2 = true;
                            // var I3 = true;

                            activeLines = [];

                            logicLines.forEach((logicLine) =>
                            {
                                let res = eval(logicLine.logic);
                                if (res == true || res == 1) {
                                    activeLines.push(logicLine.codeElement);
                                }
                            });

                            wss.broadcast(JSON.stringify({lines: activeLines}));
                        }
                    });
                });
        },
        inputTableInterval.v,
    );

});


//Подключение к клиенту
wss.on('connection', function connection(ws){
    console.log("Browser is connected");

    setTimeout(() =>
    {
        ws.send(JSON.stringify({lines: activeLines}));
    }, 1000);

    //let id = "sv0700504220631";


    // setInterval(() =>
    // {
    //     let lastSymbol = id[id.length - 1];

    //     id = (lastSymbol == "1") ? "sv0700504220632" : "sv0700504220631";
    //     ws.send(JSON.stringify({lines: [
    //         id
    //     ]}));
    // }, 3000);
    // let lastSymbol = id[id.length - 1];
    // id = (lastSymbol == "1") ? "sv0700504220632" : "sv0700504220631";

    // setTimeout(() =>
    // {
    //     ws.send(JSON.stringify({lines: [
    //         id
    //     ]}));
    // }, 3000);

    ws.on('message', function incoming(message)
    {
        console.log('Message: ' + message);
        var event = JSON.parse(message);

        if (event.type == "pressedButton")
        {
            //Выход
            // if (event.id == "1kn00-016.1")
            // {
            //     exec('kill.bat', (err, stdout, stderr) => {
            //     if (err) {
            //         console.error(err);
            //         return;
            //     }
            //     console.log(stdout);
            //     });
            //     //process.exit(1);
            //     setTimeout(() => {
            //         process.exit(1)
            //     }, 1000);
            // }
        }

    });
}).on('close', function () {
    console.log("WS CLOSED")
});


function parseTables(sheet) {
    var row = 1, col = 1;
    let tables = {};
    do {
        let tableKey = sheet[XLSX.utils.encode_cell({ c: col, r: row, })];
        if (tableKey == undefined) break;
        if (tableKey.l == undefined) break;
        let tableName = tableKey.l.location;
        let re = /.+?(?=!)/;
        let fuck = tableName.match(re)[0];
        if(fuck.startsWith("'")){
            fuck = fuck.substr(1);
            fuck = fuck.slice(0, -1);
        }
        tables[tableKey.v] = fuck;
        row++;
        // eslint-disable-next-line no-constant-condition
    } while (true);
    return tables;
}

function parseLogicLines(sheet)
{
    let logicLines = [];

    let row = 6;
    let col = 2;

    do
    {
        if (sheet[XLSX.utils.encode_cell({ r: row, c: col})] == undefined) break;

        let codeElement = sheet[XLSX.utils.encode_cell({r: row, c: col})].v;

        let lineNumber = sheet[XLSX.utils.encode_cell({r: row, c: col + 3})].v;

        let logic = "";

        let dataTable1 = [];
        let dataTable2 = [];

        if (sheet[XLSX.utils.encode_cell({ r: row, c: 4})] != undefined) 
        {
            logic = sheet[XLSX.utils.encode_cell({ r: row, c: 4})].v;
        }

        let colDT1 = 6;
        do
        {
            //console.log(sheet[XLSX.utils.encode_cell({ c: colDT1, r: 3, })].v);
            let dataItemTable1 = sheet[XLSX.utils.encode_cell({ c: colDT1, r: 3, })].v;
            let dataStateTable1;
            if (sheet[XLSX.utils.encode_cell({ c: colDT1, r: row, })] != undefined)
            {
                dataStateTable1 = sheet[XLSX.utils.encode_cell({ c: colDT1, r: row, })].v;
                dataTable1.push(JSON.stringify({item: dataItemTable1, state: dataStateTable1}));
            };
            
            
            if (sheet[XLSX.utils.encode_cell({ c: colDT1, r: 3, })].v == "item100") break;
            colDT1++;
        }while(true)

        let colDT2 = 16;
        do
        {
            //console.log(sheet[XLSX.utils.encode_cell({ c: colDT2, r: 3, })].v);
            let dataItemTable2 = sheet[XLSX.utils.encode_cell({ c: colDT2, r: 3, })].v;
            let dataStateTable2;
            if (sheet[XLSX.utils.encode_cell({ c: colDT2, r: row, })] != undefined)
            {
                dataStateTable2 = sheet[XLSX.utils.encode_cell({ c: colDT2, r: row, })].v;
                dataTable2.push(JSON.stringify({item: dataItemTable2, state: dataStateTable2}));
            };
            
            
            if (sheet[XLSX.utils.encode_cell({ c: colDT2, r: 3, })].v == "item42") break;
            colDT2++;
        }while(true)

        logicLines.push(
            {
                codeElement: codeElement,
                lineNumber: lineNumber,
                logic: logic,
                dataTable1: dataTable1,
                dataTable2: dataTable2,
            }
        );
        row++;
    }while(true)

    return logicLines;
}

// Parse controller inputs 
function parseControllerInputs(sheet) {
    let controllerInputs = new Array();
    // create get value by item name function
    controllerInputs.getByItem = (item) => {
        var controllerInput = controllerInputs.find(controllerInput => controllerInput.item == item);
        if (controllerInput != undefined) return controllerInput.value;
    };

    var row = 3, col = 1;
    do {
        let controllerItem = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
        if (controllerItem == undefined) break;
        let id = sheet[XLSX.utils.encode_cell({ r: row - 1, c: col })];
        let controllerIoName = sheet[XLSX.utils.encode_cell({ r: row + 1, c: col })];
        let controllerCode1 = sheet[XLSX.utils.encode_cell({ r: row + 2, c: col })];
        let controllerCode2 = sheet[XLSX.utils.encode_cell({ r: row + 3, c: col })];
        let controllerCode3 = sheet[XLSX.utils.encode_cell({ r: row + 4, c: col })];
        let controllerLegend = sheet[XLSX.utils.encode_cell({ r: row + 5, c: col })];
        let controllerDescription = sheet[XLSX.utils.encode_cell({ r: row + 6, c: col })];
        //console.log(`${controllerItem.v}  ${controllerDescription ? controllerDescription.v : ''}`);
        let controllerInput = new ControllerInput(id.v, controllerItem ? controllerItem.v : null,
            controllerIoName ? controllerIoName.v : null,
            controllerCode1 ? controllerCode1.v : null,
            controllerCode2 ? controllerCode2.v : null,
            controllerCode3 ? controllerCode3.v : null,
            controllerLegend ? controllerLegend.v : null,
            controllerDescription ? controllerDescription.v : null);

        controllerInputs.push(controllerInput);
        col = col + 2;
        // eslint-disable-next-line no-constant-condition
    } while (true);

    
    return controllerInputs;
}