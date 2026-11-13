import { planModeloSchema } from "@aktiv/contrato";
import { operarModelo } from "./contenido";

it("duplica la indicación heredada de una semana sin cambiar el modelo original", () => {
  const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
  const modelo=planModeloSchema.parse({id:id(1),nombre:"Base",tipo:"Fuerza",semanas:3,revision:0,sesiones:[{
    id:id(2),nombre:"Día 1",tipo:"Fuerza",dia:null,orden:0,calentamiento:"",enfriamiento:"",ejercicios:[{
      id:id(3),nombre:"Sentadilla",grupo:1,orden:0,descanso:"60 s",semanas:["4x8","","6x6"].map((prescripcion,i)=>({semana:i+1,prescripcion,peso:null,pesoFecha:null})),
    }],
  }]});
  const copia=operarModelo(modelo,{metodo:"POST",ruta:`/planes-mensuales/${modelo.id}/planificacion/copiar`,datos:{origen:2,destino:3}});
  expect(copia.sesiones[0].ejercicios[0].semanas[2].prescripcion).toBe("4x8");
  expect(modelo.sesiones[0].ejercicios[0].semanas[2].prescripcion).toBe("6x6");
});

it("rechaza una copia vacía que heredaría una indicación distinta y conserva el modelo", () => {
  const id = (n: number) => `b0000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
  const modelo=planModeloSchema.parse({id:id(1),nombre:"Base",tipo:"Fuerza",semanas:3,revision:0,sesiones:[{
    id:id(2),nombre:"Día 1",tipo:"Fuerza",dia:null,orden:0,calentamiento:"",enfriamiento:"",ejercicios:[{
      id:id(3),nombre:"Sentadilla",grupo:1,orden:0,descanso:"60 s",semanas:["","4x8","6x6"].map((prescripcion,i)=>({semana:i+1,prescripcion,peso:null,pesoFecha:null})),
    }],
  }]});
  expect(()=>operarModelo(modelo,{metodo:"POST",ruta:`/planes-mensuales/${modelo.id}/planificacion/copiar`,datos:{origen:1,destino:3}})).toThrow("No se puede copiar una indicación vacía");
  expect(modelo.sesiones[0].ejercicios[0].semanas[2].prescripcion).toBe("6x6");
});
