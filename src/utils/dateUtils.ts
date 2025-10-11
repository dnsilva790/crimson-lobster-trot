import { addMinutes, setMinutes, setHours, format, isBefore } from 'date-fns';

/**
 * Calcula o próximo intervalo de 15 minutos a partir da data/hora atual.
 * Garante que o horário retornado seja sempre no futuro.
 * @param currentDate A data/hora de referência.
 * @returns Um objeto com a data formatada (yyyy-MM-dd) e o datetime formatado (yyyy-MM-dd'T'HH:mm:ss).
 */
export const calculateNext15MinInterval = (currentDate: Date): { date: string, datetime: string } => {
  let nextTime = addMinutes(currentDate, 15); // Adiciona 15 minutos à hora atual

  // Arredonda para baixo para o próximo intervalo de 15 minutos
  const minutes = nextTime.getMinutes();
  const roundedMinutes = Math.floor(minutes / 15) * 15;
  nextTime = setMinutes(nextTime, roundedMinutes);
  nextTime = setHours(nextTime, nextTime.getHours()); // Garante que as horas também sejam definidas corretamente após o ajuste dos minutos

  // Se o tempo calculado ainda estiver no passado (por exemplo, se a hora atual fosse 10:00:01 e arredondamos para 10:00:00),
  // ou se for exatamente a hora atual, avance mais 15 minutos.
  // Isso garante que sempre obtemos um slot de 15 minutos *futuro*.
  if (isBefore(nextTime, currentDate) || nextTime.getTime() === currentDate.getTime()) {
    nextTime = addMinutes(nextTime, 15);
  }

  return {
    date: format(nextTime, "yyyy-MM-dd"),
    datetime: format(nextTime, "yyyy-MM-dd'T'HH:mm:ss"),
  };
};