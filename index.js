const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const mqtt = require("mqtt");

// --- Configurações ---
const SERIAL_PORT_PATH = "COM5"; // ❗ MUDE AQUI
const BAUD_RATE = 9600;
const MQTT_BROKER = "mqtt://broker.hivemq.com:1883";
const SENHA_CORRETA = "1234"; // <-- SUA SENHA MESTRA FICA AQUI

const COMANDO_TOPIC = "senai/iot/porta/comando"; // Web -> Arduino
const STATUS_TOPIC = "senai/iot/porta/status";   // Arduino -> Web

// --- Conexão Serial (Arduino) ---
const port = new SerialPort({ path: SERIAL_PORT_PATH, baudRate: BAUD_RATE });
const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

// --- Conexão MQTT (Broker) ---
const client = mqtt.connect(MQTT_BROKER);

client.on("connect", () => {
  console.log("Conectado ao broker MQTT!");
  client.subscribe(COMANDO_TOPIC, (err) => {
    if (!err) console.log(`Inscrito no tópico de comando: ${COMANDO_TOPIC}`);
  });
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

// --- Lógica 2: MQTT -> Arduino (Controle com Senha) ---
client.on("message", (topic, message) => {
  if (topic === COMANDO_TOPIC) {
    try {
      const msg = JSON.parse(message.toString());
      console.log("Comando recebido da Web:", msg.comando);

      // 1. VERIFICAÇÃO DA SENHA
      if (msg.senha !== SENHA_CORRETA) {
        console.log(">>> SENHA INVÁLIDA! <<<");
        // Publica um status de erro de volta para o navegador
        client.publish(STATUS_TOPIC, JSON.stringify({ status: "senha_invalida" }));
        return; // Para a execução aqui. Não envia nada ao Arduino.
      }

      // 2. Se a senha estiver correta, continua...
      console.log("Senha correta. Enviando comando ao Arduino.");
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