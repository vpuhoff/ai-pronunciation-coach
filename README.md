
# 🎙️ Prosody AI Trainer

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)
![Gemini](https://img.shields.io/badge/Google%20Gemini-AI-8E75B2?logo=google&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css&logoColor=white)

**Prosody AI Trainer** is an advanced language learning application focused on the musicality of speech: **rhythm, stress, and intonation**. 

Unlike standard language apps that only check if you said the correct word, this tool analyzes *how* you said it. It uses multimodal AI and client-side Digital Signal Processing (DSP) to provide real-time visual and analytical feedback, helping learners bridge the gap between "understandable" and "native-like" fluency.

---

## ✨ Key Features

### 🧠 Intelligent Content Generation
*   **Contextual Practice:** Generates unique, natural-sounding phrases based on your target language, topic, and difficulty level.
*   **Cognitive Ramps:** Automatically inserts natural filler words (e.g., "Actually," "You know") to help users overcome speech initiation blocks (anomia) and improve flow.
*   **Custom Scenarios:** Type any phrase or situation, and the AI will create a tailored lesson for it.

### 🔬 Deep Analysis & Feedback
*   **Multi-Dimensional Scoring:** Evaluates your speech on four pillars:
    *   **Articulation:** Phoneme accuracy and completeness.
    *   **Prosody:** Intonation curves, rhythmic stress, and flow.
    *   **Fluency:** Speed, hesitation analysis, and smoothness.
    *   **Impression:** Confidence and accent reduction.
*   **Visual Pitch Contour:** Displays your pitch curve overlaid on the native reference audio to visually identify intonation mismatches (using Client-side AMDF pitch detection).
*   **AI Coach Q&A:** Chat with the AI coach to ask specific questions about your mistakes (e.g., "How do I position my tongue for this sound?").

### 🎧 High-Fidelity Audio
*   **ElevenLabs Integration:** Uses ultra-realistic neural text-to-speech for reference audio.
*   **Google Gemini TTS:** Fallback high-quality TTS support.

### 📊 History & Progress
*   **Session Tracking:** Saves all your attempts locally using IndexedDB (for heavy audio blobs) and LocalStorage (for metadata).
*   **Analytics:** Visual charts tracking your daily activity and average score improvements over time.
*   **Export/Import:** Backup your progress or share datasets via JSON export.

---

## 🛠️ Tech Stack

*   **Frontend Framework:** React 19
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS + Lucide React (Icons)
*   **Visualization:** Recharts (Analytics) + Custom Canvas/SVG (Waveforms)
*   **AI Core:** Google Gemini API (`@google/genai`) via Multimodal Live/Flash models.
*   **Audio Generation:** ElevenLabs API.
*   **Audio Processing:** Web Audio API + Custom DSP algorithms (Pitch extraction, DTW alignment).
*   **Storage:** Browser LocalStorage + IndexedDB.

---

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18 or higher)
*   npm or yarn
*   A **Google Gemini API Key** (Get it [here](https://aistudio.google.com/))
*   (Optional) An **ElevenLabs API Key** for premium voices.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/prosody-ai-trainer.git
    cd prosody-ai-trainer
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    Create a `.env` file in the root directory and add your Google API key.
    
    ```env
    API_KEY=your_google_gemini_api_key_here
    ```
    *(Note: The ElevenLabs key is entered via the UI Settings screen for security).*

4.  **Run the development server:**
    ```bash
    npm start
    ```
    Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

---

## 📖 How to Use

1.  **Setup Session:** Choose your target language (e.g., English, Spanish, Mandarin), native language, topic, and difficulty.
2.  **Training Screen:** 
    *   Listen to the reference audio.
    *   Record your attempt.
    *   The app analyzes your speech using DSP (for the waveform) and AI (for the critique).
3.  **Results Screen:**
    *   View your **Overall Score**.
    *   Check the **Deep Analysis** grid for detailed metrics.
    *   Compare the **Pitch Contour** graph to see where your intonation went flat.
    *   Read the **AI Coach's feedback** or ask follow-up questions.
4.  **History:** Review past sessions, practice old phrases again, or view your progress charts.

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Made with ❤️ using <a href="https://react.dev/">React</a> & <a href="https://deepmind.google/technologies/gemini/">Gemini</a>
</p>
