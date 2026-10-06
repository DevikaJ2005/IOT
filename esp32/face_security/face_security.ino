/*
  Face Security System - ESP32 firmware

  Receives the security status from the laptop over Wi-Fi (HTTP) and
  drives a buzzer accordingly. The ESP32 does no face recognition -
  it only reacts to the command it is given.

  Supported commands (GET /status?state=...):
    AUTHORIZED  -> buzzer OFF
    UNKNOWN     -> buzzer ON
    NO_FACE     -> buzzer OFF
    RESET       -> buzzer OFF

  GET /ping -> used by the laptop app to check the ESP32 is reachable.
*/
#include <WiFi.h>
#include <WebServer.h>

// Update these to match the Wi‑Fi network your ESP32 should join.
// If you do not want to edit the source every time, set these at compile time.
#ifndef WIFI_SSID
#define WIFI_SSID "YOUR_WIFI_SSID"
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#endif

// Configurable GPIO - change this to match your wiring.
const int BUZZER_PIN = 4;

WebServer server(80);

void setBuzzer(const String& state) {
  if (state == "UNKNOWN") {
    Serial.println("Buzzer ON (UNKNOWN state)");
    digitalWrite(BUZZER_PIN, HIGH);
  } else {
    // AUTHORIZED, NO_FACE, RESET, or anything unrecognized -> OFF (fail-safe)
    Serial.println("Buzzer OFF (" + state + ")");
    digitalWrite(BUZZER_PIN, LOW);
  }
}

void handleStatus() {
  if (!server.hasArg("state")) {
    server.send(400, "text/plain", "Missing 'state' parameter");
    return;
  }
  String state = server.arg("state");
  Serial.println("Received status: " + state);
  setBuzzer(state);
  server.send(200, "text/plain", "OK");
}

void handlePing() {
  server.send(200, "text/plain", "OK");
}

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Connected! ESP32 IP address: ");
  Serial.println(WiFi.localIP());

  server.on("/status", handleStatus);
  server.on("/ping", handlePing);
  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  server.handleClient();
}
