import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import { Explorer } from "@/pages/Explorer";
import Wallet from "@/pages/Wallet";
import { TransactionDetail } from "@/pages/TransactionDetail";
import { BlockDetail } from "@/pages/BlockDetail";
import { AddressDetail } from "@/pages/AddressDetail";
import { ValidatorDetail } from "@/pages/ValidatorDetail";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastContainer, useToast } from "@/components/Toast";

export default function App() {
  const { toasts, removeToast } = useToast();

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explorer" element={<Explorer />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/tx/:hash" element={<TransactionDetail />} />
          <Route path="/block/:height" element={<BlockDetail />} />
          <Route path="/address/:address" element={<AddressDetail />} />
          <Route path="/validator/:address" element={<ValidatorDetail />} />
          <Route path="/other" element={<div className="text-center text-xl">Other Page - Coming Soon</div>} />
        </Routes>
      </Router>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ErrorBoundary>
  );
}
