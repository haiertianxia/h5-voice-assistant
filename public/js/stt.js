// STT is handled directly by browser Web Speech API in app.js
// No audio upload needed - SpeechRecognition uses microphone stream directly
export class SpeechRecognizer {
  isAvailable() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
}
