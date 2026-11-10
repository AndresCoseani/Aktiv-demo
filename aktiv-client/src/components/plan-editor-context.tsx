"use client";
import { createContext, useContext } from "react";
import { api } from "@/lib/api";

export const PlanEditorContext = createContext({ api, modelo: false });
export const usePlanEditor = () => useContext(PlanEditorContext);
