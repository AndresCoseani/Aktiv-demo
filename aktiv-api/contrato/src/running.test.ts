import {describe,it,expect} from "vitest";
import {tipoDiaRunning,textoDiaRunning,actualizarRunning,guardarRunningApi,copiarSemanaRunningApi,runningSchema} from "./running";
describe("Grilla de Running",()=>{
 it("mantiene celdas y semanas independientes, sin herencia implícita",()=>{const base={"1":{lunes:"Suave",volumen:"20"},"2":{martes:"Descanso"}};const siguiente=actualizarRunning(base,{semana:2,campo:"jueves",texto:"10 min suaves + 4 pasadas"});expect(siguiente[1]).toEqual(base[1]);expect(siguiente[2].lunes).toBeUndefined();expect(siguiente[2].martes).toBe("Descanso");expect(base[2]).not.toHaveProperty("jueves");});
 it("permite texto y saltos de línea, limita volumen y rechaza campos ajenos",()=>{expect(guardarRunningApi.safeParse({semana:1,campo:"martes",texto:"Entrada suave\n4 × 200 m\nAfloje"}).success).toBe(true);for(const texto of ["32","32,5","32.5",""])expect(guardarRunningApi.safeParse({semana:1,campo:"volumen",texto}).success).toBe(true);for(const cambio of [{semana:0,campo:"lunes",texto:""},{semana:105,campo:"lunes",texto:""},{semana:1,campo:"volumen",texto:"-10"},{semana:1,campo:"otro",texto:""},{semana:1,campo:"lunes",texto:"x".repeat(4001)}])expect(guardarRunningApi.safeParse(cambio).success).toBe(false);});
 it("rechaza copias sobre la misma semana y datos fuera de contrato",()=>{expect(copiarSemanaRunningApi.safeParse({origen:1,destino:1}).success).toBe(false);expect(runningSchema.safeParse({"0":{lunes:""}}).success).toBe(false);expect(runningSchema.safeParse({"1":{secreto:""}}).success).toBe(false);});
});


describe("tipo de día",()=>{
 it("reconoce el texto anterior y conserva el borrador",()=>{expect(tipoDiaRunning({lunes:"gym"},"lunes")).toBe("GYM");expect(textoDiaRunning({lunes:"Series guardadas",lunes_tipo:"GYM"},"lunes")).toBe("GYM");expect(textoDiaRunning({lunes:"Series guardadas",lunes_tipo:"Running"},"lunes")).toBe("Series guardadas");});
 it("valida los modos",()=>{expect(guardarRunningApi.safeParse({semana:1,campo:"lunes_tipo",texto:"GYM"}).success).toBe(true);expect(guardarRunningApi.safeParse({semana:1,campo:"lunes_tipo",texto:"otro"}).success).toBe(false);});
});
