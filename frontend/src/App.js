import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardLayout from "@/components/Dashboard";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardLayout />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
