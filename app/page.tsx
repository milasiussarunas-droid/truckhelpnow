export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl md:text-5xl font-bold mb-4">
        Truck repair & diagnostic help — fast.
      </h1>

      <p className="text-lg text-gray-600 max-w-xl mb-8">
        Describe your problem, enter fault codes, and get guided next steps
        to keep your truck moving.
      </p>

      <a
        href="/chat"
        className="bg-black text-white px-6 py-3 rounded-xl text-lg font-semibold hover:opacity-90 transition"
      >
        Start Diagnostic
      </a>

      <p className="text-sm text-gray-500 mt-10 max-w-md">
        Informational guidance only. Always follow proper safety procedures and
        consult a qualified technician when needed.
      </p>
    </main>
  );
}