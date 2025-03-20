import Image from "next/image";
import { Poppins } from "next/font/google";
import MintFeature from "../app/components/MintFeature";

// Load Poppins font with weights 400, 600, 700
const poppins = Poppins({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins", // CSS variable
});

export default function Home() {
  return (
    <div className={`${poppins.variable} min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-black text-white overflow-hidden`}>
      <section className="flex flex-col items-center py-12 px-4 md:pt-32 md:pb-20">
        <div className="flex flex-col items-center w-full max-w-xs md:flex-row md:max-w-6xl md:gap-20">
          {/* NFT Image */}
          <div className="w-full mb-8 md:max-w-xl md:mb-0 group relative">
            <div className="animate-nft-cycle w-full rounded-xl shadow-2xl border-4 border-purple-600 overflow-hidden relative">
              <Image src="/images/nft-1.png" alt="NFT 1" width={450} height={450} className="w-full object-cover transition-transform duration-500 group-hover:scale-110 group-hover:rotate-2" />
              <Image src="/images/nft-2.png" alt="NFT 2" width={450} height={450} className="w-full object-cover transition-transform duration-500 group-hover:scale-110 group-hover:rotate-2 absolute top-0 left-0 opacity-0" />
              <Image src="/images/nft-3.png" alt="NFT 3" width={450} height={450} className="w-full object-cover transition-transform duration-500 group-hover:scale-110 group-hover:rotate-2 absolute top-0 left-0 opacity-0" />
              <Image src="/images/nft-4.png" alt="NFT 4" width={450} height={450} className="w-full object-cover transition-transform duration-500 group-hover:scale-110 group-hover:rotate-2 absolute top-0 left-0 opacity-0" />
              <Image src="/images/nft-5.png" alt="NFT 5" width={450} height={450} className="w-full object-cover transition-transform duration-500 group-hover:scale-110 group-hover:rotate-2 absolute top-0 left-0 opacity-0" />
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 opacity-50 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="absolute inset-0 shadow-[inset_0_0_30px_rgba(147,51,234,0.5)] group-hover:shadow-[inset_0_0_50px_rgba(147,51,234,0.8)] transition-shadow duration-500" />
            </div>
          </div>

          {/* Minting Component */}
          <MintFeature />
        </div>
      </section>

      <footer className="py-4 text-center text-gray-500 text-sm">
        <p>© 2025 Cosmic NFT Drop. All rights reserved.</p>
      </footer>
    </div>
  );
}

// Disable static prerendering for this page
export const dynamic = "force-dynamic";