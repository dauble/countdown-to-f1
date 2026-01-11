import "./globals.css";

// Note: Using GitHub asset URLs for favicon and social share images.
// For production use, consider hosting these images in the /public directory
// and updating the URLs to relative paths (e.g., "/favicon.png", "/og-image.png")
export const metadata = {
  title: "Yoto Formula 1 Card Generator",
  description: "Create Yoto cards with Formula 1 information",
  icons: {
    icon: "https://github.com/user-attachments/assets/6980f9d0-33cd-46dc-af23-bb3454477fc7",
  },
  openGraph: {
    title: "Yoto Formula 1 Card Generator",
    description: "Create Yoto cards with Formula 1 information",
    images: [
      {
        url: "https://github.com/user-attachments/assets/930f900e-54a3-4b84-8c4d-9759d3485725",
        width: 1024,
        height: 1024,
        alt: "Countdown to F1 - Racing car on track",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Yoto Formula 1 Card Generator",
    description: "Create Yoto cards with Formula 1 information",
    images: ["https://github.com/user-attachments/assets/930f900e-54a3-4b84-8c4d-9759d3485725"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
