import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export function NvidiaAiPage() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/app/ai/assistant', { replace: true }); }, [navigate]);
  return null;
}
