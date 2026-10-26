import type {CaseStatus,Priority} from '../types';
export function StatusBadge({status}:{status:CaseStatus|string}){return <span className={`badge status-${status.toLowerCase()}`}>{status.replace('_',' ')}</span>}
export function PriorityBadge({priority}:{priority:Priority|string}){return <span className={`badge priority-${priority.toLowerCase()}`}>{priority}</span>}
