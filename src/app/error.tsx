"use client";

/** Si algo se rompe al dibujar, se ofrece salir sin dejar la pantalla en blanco. */
export default function Error() {
  const empezar = () => {
    try {
      localStorage.removeItem("dislogic:autosave");
    } catch {
      /* sin almacenamiento: alcanza con recargar */
    }
    location.href = location.pathname;
  };
  return (
    <main className="flex h-dvh items-center justify-center p-6">
      <div className="max-w-sm border border-linea-fuerte bg-hoja p-5">
        <h1 className="text-[17px] font-bold text-tinta">No se pudo dibujar este circuito</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-tinta-2">Puede estar dañado. Empezá con una hoja vacía para seguir trabajando.</p>
        <button onClick={empezar} className="mt-3 border border-tinta bg-tinta px-3 py-2 text-[13px] font-bold text-papel">
          Empezar con una hoja vacía
        </button>
      </div>
    </main>
  );
}
