import * as XLSX from 'xlsx';
import { TodoistTask } from "@/lib/types";
import { format, parseISO, isValid } from "date-fns";
import { getSolicitante, getDelegateNameFromLabels, get5W2H } from "@/lib/utils"; // Importar utilitários e get5W2H

interface ExportableTask {
  ID: string;
  Conteúdo: string;
  Descrição: string;
  Prioridade: string;
  Urgência: number | string; // Adicionado
  Importância: number | string; // Adicionado
  Vencimento: string;
  Deadline: string;
  Recorrência: string;
  Duração_Minutos: number | string;
  Solicitante: string; // Adicionado
  Responsável: string; // Adicionado
  '5W2H_O_Que': string; // Novo
  '5W2H_Por_Que': string; // Novo
  '5W2H_Quem': string; // Novo
  '5W2H_Onde': string; // Novo
  '5W2H_Quando': string; // Novo
  '5W2H_Como': string; // Novo
  '5W2H_Quanto': string; // Novo
  Etiquetas: string;
  URL: string;
}

const formatTaskForExport = (task: TodoistTask): ExportableTask => {
  const dueDate = task.due?.datetime || task.due?.date;
  const formattedDueDate = dueDate && isValid(parseISO(dueDate)) 
    ? format(parseISO(dueDate), "dd/MM/yyyy HH:mm") 
    : "";

  const formattedDeadline = task.deadline && isValid(parseISO(task.deadline))
    ? format(parseISO(task.deadline), "dd/MM/yyyy")
    : "";

  // Assume que a tarefa pode ter as propriedades urgency e importance se vier do estado do Eisenhower
  const urgency = (task as any).urgency !== undefined && (task as any).urgency !== null ? (task as any).urgency : "";
  const importance = (task as any).importance !== undefined && (task as any).importance !== null ? (task as any).importance : "";

  const w2h = get5W2H(task); // Obter dados 5W2H

  return {
    ID: task.id,
    Conteúdo: task.content,
    Descrição: task.description,
    Prioridade: `P${task.priority}`,
    Urgência: urgency,
    Importância: importance,
    Vencimento: formattedDueDate,
    Deadline: formattedDeadline,
    Recorrência: task.due?.is_recurring ? (task.due.string || "Sim") : "Não",
    Duração_Minutos: task.estimatedDurationMinutes || "",
    Solicitante: getSolicitante(task) || "", // Usar utilitário
    Responsável: getDelegateNameFromLabels(task.labels) || "", // Usar utilitário
    '5W2H_O_Que': w2h.what,
    '5W2H_Por_Que': w2h.why,
    '5W2H_Quem': w2h.who,
    '5W2H_Onde': w2h.where,
    '5W2H_Quando': w2h.when,
    '5W2H_Como': w2h.how,
    '5W2H_Quanto': w2h.howMuch,
    Etiquetas: task.labels.join(', '),
    URL: task.url,
  };
};

export const exportTasksToExcel = (tasks: TodoistTask[], filename: string = 'relatorio_tarefas') => {
  if (!tasks || tasks.length === 0) {
    console.error("Nenhuma tarefa para exportar.");
    return;
  }

  const dataToExport: ExportableTask[] = tasks.map(formatTaskForExport);

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tarefas");

  // Write the workbook to a file
  XLSX.writeFile(workbook, `${filename}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
};