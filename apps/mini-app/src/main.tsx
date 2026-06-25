import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { TelegramProvider } from './tg';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TelegramProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </TelegramProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
