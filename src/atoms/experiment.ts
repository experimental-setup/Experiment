import { atom } from "jotai";
import { focusAtom } from "jotai-optics";
import type { Message } from "../types";
import { entangledAtom } from "../utils/entanglement";
import { parentAtom, storeAtom } from "./store";

export const experimentAtom = entangledAtom("experiment", atom<Message[]>([]));

export type ExperimentCursor = { id: string; runId: string };

const newIdForObject = <T extends object>(ob: T) => {
  return Object.keys(ob).reduce((max, thisId) => {
    const asNumber = Number(thisId);
    if (!Number.isNaN(asNumber)) {
      return Math.max(max, asNumber);
    }
    return max;
  }, 0);
};

export const createExperiment = atom(
  null,
  (get, set, messages?: Message[], id?: string, runId?: string): ExperimentCursor => {
    const experiments = get(experimentsAtom) ?? {};

    const parent = get(parentAtom);

    id ??= parent;

    id ??= String(newIdForObject(experiments) + 1);

    const thisExperiment = experiments[id] ?? {};

    runId ??= String(newIdForObject(thisExperiment) + 1);

    const newExperiments = {
      ...experiments,
      [id]: {
        ...thisExperiment,
        [runId]: (messages ?? []).map((message) => ({
          ...message,
        })),
      },
    };

    set(experimentsAtom, newExperiments);

    return { id, runId };
  },
);

export const experimentsAtom = focusAtom(storeAtom, (o) => o.prop("experiments"));

export const deleteExperiment = entangledAtom(
  "deleteExperiment",
  atom(null, (get, set, { id, runId }: ExperimentCursor) => {
    const { [id]: thisSerialExperiment, ...experiments } = get(experimentsAtom) ?? {};
    const { [runId]: _, ...experiment } = thisSerialExperiment;
    if (Object.keys(experiment).length > 0) {
      set(experimentsAtom, { ...experiments, [id]: experiment });
      return;
    }
    set(experimentsAtom, experiments);
  }),
);

export const getExperimentAtom = ({ id, runId }: ExperimentCursor) =>
  focusAtom(storeAtom, (o) => o.prop("experiments").optional().prop(id).optional().prop(runId));
