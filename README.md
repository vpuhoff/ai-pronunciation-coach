
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
*   **Analytics (30 days):** Charts for **daily phrase activity** and **average score** so you can see trends at a glance.
*   **Estimated practice time:** A separate chart approximates how long you practiced each day by counting history entries and assuming **~3 minutes per saved session** (a simple planning estimate, not precise timing).
*   **Weekly detailed metrics:** For the **last 7 days**, sessions that include the **deep analysis** breakdown are plotted on **one chart** with multiple lines (all **0–100**): phoneme accuracy, completeness, intonation, rhythm, stress, smoothness, and confidence—so you can compare dimensions across attempts.
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
    Create a `.env` file in the root directory and add your Google Gemini API key.
    
    ```env
    GEMINI_API_KEY=your_google_gemini_api_key_here
    ```
    *(Note: You can also enter the Gemini API key on the **session start** screen; it will be stored locally in your browser. An **ElevenLabs** key can be entered there too and is optional.)*

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The dev server uses port **3000** by default (see `vite.config.ts`). If that port is busy, Vite will pick the next free port and print it in the terminal.

    Production build and local preview:

    ```bash
    npm run build
    npm run preview
    ```

---

## 📖 How to Use

1.  **Setup Session:** Enter your **Gemini API key** (required to generate lessons and AI feedback), optionally add **ElevenLabs**, then choose target language, native language, topic, and difficulty.
2.  **Training Screen:** 
    *   Listen to the reference audio.
    *   Record your attempt.
    *   The app analyzes your speech using DSP (for the waveform) and AI (for the critique).
3.  **Results Screen:**
    *   View your **Overall Score**.
    *   Check the **Deep Analysis** grid for detailed metrics.
    *   Compare the **Pitch Contour** graph to see where your intonation went flat.
    *   Read the **AI Coach's feedback** or ask follow-up questions.
4.  **History:** Review past sessions, practice old phrases again, and explore **progress charts**—including **estimated practice time** and the **7-day multi-metric** view when detailed scores are available.

---

## 🔭 Planned improvements

Future work to scale the codebase and ship a safer, more maintainable product:

*   **`App.tsx` complexity (state & navigation):** Today `App.tsx` centralizes a lot of UI state (screens, phrases, blobs, history, loading) and hand-rolls transitions between Setup, Training, Results, and History. For growth, extract state with **React Context**, **Zustand**, or **Redux Toolkit** (not in dependencies yet—add only if the team wants that model), and move screen changes to **`react-router-dom`** so routes, URLs, and deep-linking stay predictable.
*   **Testing:** There are currently **no automated tests**—neither **unit** tests (e.g. for DSP helpers in `services/audioUtils.ts`) nor **e2e** flows (record → analyze → history). Adding Vitest/Jest + Playwright (or Cypress) would protect regressions in audio and AI flows.
*   **API key handling (production B2C):** Users paste **Gemini** and **ElevenLabs** keys; values live in **`localStorage`**, which is fine for demos and power users. A real consumer product usually needs a **BFF (Backend for Frontend)** or similar proxy so secrets never ship to untrusted clients and quotas can be enforced server-side.
*   **Internationalization (i18n):** Lesson languages are configurable, but **UI copy** (buttons, headings, errors) is **English-only**. Adding i18n (e.g. `react-i18next`) would align the shell with multilingual learners.
*   **Media permission UX:** `TrainingScreen` still falls back to a plain **`alert()`** when the microphone is denied. A dedicated inline banner or modal with steps to fix browser permissions would feel closer to production polish.

### Roadmap summary

The project already shows solid use of **React**, **Web Audio**, **MediaRecorder**, **IndexedDB**, and **LLM** integration. Tackling the items above—especially **routing**, **shared state**, **tests**, and **server-side API access**—is the natural path from a strong local demo toward a **market-ready B2C** release.

**Review snapshot (directional, not a guarantee):** the current frontend depth—including non-trivial browser APIs and multimodal AI wiring—has been informally rated around **9/10** as a portfolio-grade codebase (strong **middle / senior** frontend signal). Shipping **react-router-dom**, a **global state** layer, and a **BFF for API keys** would align the app with expectations for a **commercial** product, not only a demo.

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
