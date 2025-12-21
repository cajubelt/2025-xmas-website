import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Emily from './pages/Emily';
import Tammy from './pages/Tammy';
import Richard from './pages/Richard';
import Michie from './pages/Michie';
import './App.css';

function Home() {
  return (
    <div>
      <h1>Andrews Family Christmas</h1>
      <nav>
        <ul>
          <li><Link to="/emily">Emily</Link></li>
          <li><Link to="/tammy">Tammy</Link></li>
          <li><Link to="/richard">Richard</Link></li>
          <li><Link to="/michie">Michie</Link></li>
        </ul>
      </nav>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/emily" element={<Emily />} />
        <Route path="/tammy" element={<Tammy />} />
        <Route path="/richard" element={<Richard />} />
        <Route path="/michie" element={<Michie />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
