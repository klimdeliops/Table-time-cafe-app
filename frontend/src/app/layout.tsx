import type { Metadata } from 'next';
import './globals.css';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AuthProvider }   from '@/contexts/AuthContext';
import { CartProvider }   from '@/contexts/CartContext';
import { ToastProvider }  from '@/contexts/ToastContext';
import { Navbar }         from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Table & Time',
  description: 'Restaurant management system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-brand-cream text-brand-espresso antialiased">
        <LocaleProvider>
          <AuthProvider>
            <CartProvider>
              <ToastProvider>
                <Navbar />
                <main className="pt-[68px]">
                  {children}
                </main>
              </ToastProvider>
            </CartProvider>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
