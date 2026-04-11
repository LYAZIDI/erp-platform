import { useEffect } from 'react';
import { useDesignerStore } from '../store/designerStore';
import type { ValidationIssue } from '../types';

export function useValidation() {
  const nodes   = useDesignerStore(s => s.nodes);
  const edges   = useDesignerStore(s => s.edges);
  const setIssues = useDesignerStore(s => s.setValidationIssues);

  useEffect(() => {
    const issues: ValidationIssue[] = [];
    const initialNodes = nodes.filter(n => n.data.isInitial);
    const finalNodes   = nodes.filter(n => n.data.isFinal);

    if (initialNodes.length === 0)
      issues.push({ level: 'error', message: 'Aucun état initial défini. Marquez exactement un état comme initial.' });
    if (initialNodes.length > 1)
      issues.push({ level: 'error', message: 'Plusieurs états initiaux définis. Un seul est autorisé.' });
    if (finalNodes.length === 0)
      issues.push({ level: 'info', message: 'Aucun état terminal. Pensez à marquer au moins un état comme final.' });

    for (const e of edges) {
      if (!e.data?.key?.trim())
        issues.push({ level: 'error', message: `Transition sans clé définie.`, edgeId: e.id });
    }

    // Check duplicates
    const edgeKeys = edges.map(e => e.data?.key).filter(Boolean);
    const dupKeys = edgeKeys.filter((k, i) => edgeKeys.indexOf(k) !== i);
    for (const k of new Set(dupKeys))
      issues.push({ level: 'error', message: `Clé de transition dupliquée : "${k}"` });

    // Check orphan references
    const nodeKeys = new Set(nodes.map(n => n.data.key));
    for (const e of edges) {
      if (e.data?.fromStateKey && !nodeKeys.has(e.data.fromStateKey))
        issues.push({ level: 'error', message: `Transition "${e.data.key}" référence un état source inexistant : "${e.data.fromStateKey}"`, edgeId: e.id });
      if (e.data?.toStateKey && !nodeKeys.has(e.data.toStateKey))
        issues.push({ level: 'error', message: `Transition "${e.data.key}" référence un état cible inexistant : "${e.data.toStateKey}"`, edgeId: e.id });
    }

    // Unreachable states
    const reachableFromInitial = new Set<string>();
    const initKeys = initialNodes.map(n => n.data.key);
    const queue = [...initKeys];
    while (queue.length) {
      const cur = queue.shift()!;
      reachableFromInitial.add(cur);
      for (const e of edges) {
        if (e.data?.fromStateKey === cur && !reachableFromInitial.has(e.data.toStateKey))
          queue.push(e.data.toStateKey);
      }
    }
    for (const n of nodes) {
      if (!n.data.isInitial && !reachableFromInitial.has(n.data.key))
        issues.push({ level: 'warning', message: `L'état "${n.data.label}" est inatteignable.`, nodeId: n.id });
    }

    // Dead-end states (non-final, no outgoing)
    for (const n of nodes) {
      if (!n.data.isFinal && !edges.some(e => e.data?.fromStateKey === n.data.key))
        issues.push({ level: 'warning', message: `L'état "${n.data.label}" est un cul-de-sac (aucune transition sortante, non final).`, nodeId: n.id });
    }

    setIssues(issues);
  }, [nodes, edges, setIssues]);
}
