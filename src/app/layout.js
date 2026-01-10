import "./globals.css";

export const metadata = {
  title: "Yoto Formula 1 Card Generator",
  description: "Create Yoto cards with Formula 1 information",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
