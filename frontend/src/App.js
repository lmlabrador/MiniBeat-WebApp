import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import ECGWaveformPanel from "@/components/ECGWaveformPanel.tsx";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Home = () => {
  const helloWorldApi = async () => {
    try {
      const response = await axios.get(`${API}/`);
      console.log(response.data.message);
    } catch (e) {
      console.error(e, `errored out requesting / api`);
    }
  };

  useEffect(() => {
    helloWorldApi();
  }, []);

  return (
    <div className="min-h-screen p-8" style={{ background: 'var(--background-dark)' }}>
      <div className="max-w-7xl mx-auto">
        <h1 
          className="text-3xl font-bold mb-8 text-center"
          style={{ color: 'var(--eerie-black)' }}
        >
          ECG Waveform Viewer
        </h1>
        <ECGWaveformPanel />
      </div>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
