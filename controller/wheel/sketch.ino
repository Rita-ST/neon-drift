
#include <Arduino.h>

// =================================
// NEON DRIFT - ESP32 WHEEL
// =================================

const int STEERING_PIN = 34;
const int THROTTLE_PIN = 25;
const int BRAKE_PIN = 26;
const int ITEM_PIN = 27;

const int LED_PIN = 2;
const int BUZZER_PIN = 18;

const unsigned long SEND_INTERVAL = 33;

unsigned long lastSend = 0;
unsigned long ledOffTime = 0;

int previousItem = 0;

String feedbackBuffer = "";

float readSteering() {
  int raw = analogRead(STEERING_PIN);

  // Convert ADC reading to -1.0 to +1.0
  float steering = (raw - 2048.0) / 2048.0;

  steering = constrain(steering, -1.0, 1.0);

  if (abs(steering) < 0.08) {
    steering = 0.0;
  }

  return steering;
}

void feedback(String event) {
  digitalWrite(LED_PIN, HIGH);
  ledOffTime = millis() + 500;

  if (event == "boost") {
    tone(BUZZER_PIN, 1200, 150);
  }
  else if (event == "hit") {
    tone(BUZZER_PIN, 300, 400);
  }
  else if (event == "finish") {
    tone(BUZZER_PIN, 1800, 500);
    ledOffTime = millis() + 2000;
  }
}

void readFeedback() {
  while (Serial.available()) {
    char c = Serial.read();

    if (c == '\n') {
      if (feedbackBuffer.indexOf("\"event\":\"boost\"") >= 0) {
        feedback("boost");
      }
      else if (feedbackBuffer.indexOf("\"event\":\"hit\"") >= 0) {
        feedback("hit");
      }
      else if (feedbackBuffer.indexOf("\"event\":\"finish\"") >= 0) {
        feedback("finish");
      }

      feedbackBuffer = "";
    }
    else if (c != '\r' && feedbackBuffer.length() < 200) {
      feedbackBuffer += c;
    }
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(THROTTLE_PIN, INPUT_PULLUP);
  pinMode(BRAKE_PIN, INPUT_PULLUP);
  pinMode(ITEM_PIN, INPUT_PULLUP);

  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  analogReadResolution(12);

  digitalWrite(LED_PIN, LOW);

  Serial.println("{\"type\":\"controller_ready\"}");
}

void loop() {
  readFeedback();

  if (ledOffTime != 0 && millis() >= ledOffTime) {
    digitalWrite(LED_PIN, LOW);
    ledOffTime = 0;
  }

  unsigned long now = millis();

  if (now - lastSend >= SEND_INTERVAL) {
    lastSend = now;

    float steering = readSteering();

    int throttle = !digitalRead(THROTTLE_PIN);
    int brake = !digitalRead(BRAKE_PIN);
    int useItem = !digitalRead(ITEM_PIN);

    Serial.print("{\"type\":\"controller_input\"");
    Serial.print(",\"steer\":");
    Serial.print(steering, 3);

    Serial.print(",\"throttle\":");
    Serial.print(throttle);

    Serial.print(",\"brake\":");
    Serial.print(brake);

    Serial.print(",\"use_item\":");
    Serial.print(useItem);

    Serial.println("}");

    previousItem = useItem;
  }
}
