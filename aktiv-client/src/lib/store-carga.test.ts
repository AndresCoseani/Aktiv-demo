import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const remoto = vi.hoisted(() => ({
  configurarSync: vi.fn(), alCerrarSesion: vi.fn(), obtenerSesion: vi.fn(), cargarDatos: vi.fn(), fijarBase: vi.fn(), limpiarBase: vi.fn(), sincronizar: vi.fn(), hayCambiosPendientes: vi.fn(() => false), iniciarSesion: vi.fn(), cerrarSesion: vi.fn(), cambiarClave: vi.fn(),
}));
vi.mock("./remoto", () => remoto);
vi.mock("react", () => ({ useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot() }));
const session = { username: "profe@example.test", role: "coach", nombre: "Profe", userId: "profe" };
const datos = { alumnos: [], carreras: [], inscripciones: [], ejerciciosCustom: [], categoriasEjercicio: [] };

describe("carga y ciclo de vida de la sesión", () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    remoto.obtenerSesion.mockResolvedValue(session); remoto.cargarDatos.mockResolvedValue(datos);
    remoto.iniciarSesion.mockResolvedValue({ session }); remoto.sincronizar.mockResolvedValue(undefined);
    vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });
  it("comparte el arranque entre montajes simultáneos", async () => {
    const store = await import("./store");
    await Promise.all([store.iniciarStore(), store.iniciarStore(), store.iniciarStore()]);
    expect(remoto.obtenerSesion).toHaveBeenCalledTimes(1); expect(remoto.cargarDatos).toHaveBeenCalledTimes(1);
  });
  it("un fallo de datos conserva la sesión, no consulta en bucle y permite reintentar", async () => {
    remoto.cargarDatos.mockRejectedValueOnce(new Error("Base temporalmente no disponible"));
    const store = await import("./store"); await store.iniciarStore();
    expect(store.useStore()).toMatchObject({ session, listo: true, errorCarga: "Base temporalmente no disponible" });
    const quitar = store.observarVisibilidadStore();
    for (let i = 0; i < 20; i++) document.dispatchEvent(new Event("visibilitychange"));
    expect(remoto.cargarDatos).toHaveBeenCalledTimes(1);
    await Promise.all([store.reintentarCarga(), store.reintentarCarga()]);
    expect(remoto.cargarDatos).toHaveBeenCalledTimes(2); expect(store.useStore().errorCarga).toBeNull();
    expect(remoto.cerrarSesion).not.toHaveBeenCalled(); quitar();
  });
  it("desuscribe los listeners al desmontar y limita recargas al volver a la pestaña", async () => {
    const store = await import("./store"); await store.iniciarStore();
    const quitar = store.observarVisibilidadStore(); quitar();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange")); expect(remoto.sincronizar).not.toHaveBeenCalled();
    const quitarNuevo = store.observarVisibilidadStore();
    document.dispatchEvent(new Event("visibilitychange")); expect(remoto.sincronizar).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    for (let i = 0; i < 20; i++) document.dispatchEvent(new Event("visibilitychange"));
    expect(remoto.cargarDatos).toHaveBeenCalledTimes(1); quitarNuevo();
  });
  it("no aplica una respuesta de carga si se cerró la sesión mientras tanto", async () => {
    const store = await import("./store"); await store.iniciarStore();
    let resolver!: (d: typeof datos) => void;
    remoto.cargarDatos.mockReturnValueOnce(new Promise((r) => { resolver = r; }));
    const pendiente = store.reintentarCarga(); await store.logout(); resolver(datos); await pendiente;
    expect(store.useStore().session).toBeNull(); expect(remoto.fijarBase).toHaveBeenCalledTimes(1);
  });
  it("el login válido no cierra la sesión cuando falla la carga de datos", async () => {
    remoto.cargarDatos.mockRejectedValueOnce(new Error("Migración pendiente"));
    const store = await import("./store"); const r = await store.login(session.username, "clave");
    expect(r.ok).toBe(true); expect(store.useStore().errorCarga).toBe("Migración pendiente");
    expect(remoto.cerrarSesion).not.toHaveBeenCalled();
  });
});
