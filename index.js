const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline"); // Precisamos dele de volta
const mqtt = require("mqtt");

// --- Configurações ---
const SERIAL_PORT_PATH = "COM5"; // ❗ MUDE AQUI
const BAUD_RATE = 9600;
const MQTT_BROKER = "mqtt://broker.hivemq.com:1883";

// --- NOSSOS DOIS TÓPICOS ---
const COMANDO_TOPIC = "senai/iot/porta/comando"; // Web -> Arduino
const STATUS_TOPIC = "senai/iot/porta/status";   // Arduino -> Web

// --- Conexão Serial (Arduino) ---
const port = new SerialPort({ path: SERIAL_PORT_PATH, baudRate: BAUD_RATE });
const parser = port.pipe(new ReadlineParser({ delimiter: "\n" })); // Usando o parser

// --- Conexão MQTT (Broker) ---
const client = mqtt.connect(MQTT_BROKER);

client.on("connect", () => {
  console.log("Conectado ao broker MQTT!");
  // 1. Se inscreve no tópico de COMANDO (para receber da Web)
  client.subscribe(COMANDO_TOPIC, (err) => {
    if (!err) console.log(`Inscrito no tópico de comando: ${COMANDO_TOPIC}`);
  });
  // 2. O cliente web vai se inscrever no tópico de STATUS
});

// --- Lógica 1: Arduino -> MQTT (Feedback de Status) ---
parser.on("data", (line) => {
  try {
    const data = JSON.parse(line.trim());
    if (data.status) {
      console.log("Recebido status do Arduino:", data);
      client.publish(STATUS_TOPIC, JSON.stringify(data)); // Publica o status
    }
  } catch (err) {
    console.error("Erro ao parsear linha do Arduino:", line);
  }
});

// --- Lógica 2: MQTT -> Arduino (Controle) ---
client.on("message", (topic, message) => {
  if (topic === COMANDO_TOPIC) {
    try {
      const msg = JSON.parse(message.toString());
      console.log("Comando recebido da Web:", msg);

      if (msg.comando === "abrir") {
        port.write('A', (err) => {
          if (err) return console.log('Erro ao escrever na serial: ', err.message);
          console.log("Comando 'Abrir' enviado ao Arduino.");
        });
      } else if (msg.comando === "fechar") {
        port.write('F', (err) => {
          if (err) return console.log('Erro ao escrever na serial: ', err.message);
          console.log("Comando 'Fechar' enviado ao Arduino.");
        });
      }
    } catch (e) {
      console.error("Erro ao processar comando MQTT:", e);
    }
  }
});