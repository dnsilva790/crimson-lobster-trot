import { supabase } from '@/integrations/supabase/client';
import { EisenhowerTask } from '@/lib/types';

interface RatingData {
  todoist_task_id: string;
  urgency: number | null;
  importance: number | null;
  quadrant: string | null;
}

export const eisenhowerService = {
  /**
   * Busca todas as avaliações de Eisenhower para o usuário logado.
   * @returns Um mapa de Todoist Task ID para RatingData.
   */
  async fetchAllRatings(): Promise<Map<string, RatingData>> {
    const { data, error } = await supabase
      .from('eisenhower_ratings')
      .select('todoist_task_id, urgency, importance, quadrant');

    if (error) {
      console.error('Supabase Error fetching Eisenhower ratings:', error);
      return new Map();
    }

    const ratingsMap = new Map<string, RatingData>();
    data.forEach(item => {
      ratingsMap.set(item.todoist_task_id, {
        todoist_task_id: item.todoist_task_id,
        urgency: item.urgency,
        importance: item.importance,
        quadrant: item.quadrant,
      });
    });

    return ratingsMap;
  },

  /**
   * Salva ou atualiza uma única avaliação de Eisenhower.
   */
  async upsertRating(rating: RatingData): Promise<RatingData | null> {
    const { todoist_task_id, urgency, importance, quadrant } = rating;
    
    // O Supabase lida com o user_id automaticamente via RLS e auth.uid()
    const { data, error } = await supabase
      .from('eisenhower_ratings')
      .upsert({
        todoist_task_id,
        urgency,
        importance,
        quadrant,
      }, { 
        onConflict: 'todoist_task_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase Error upserting Eisenhower rating:', error);
      return null;
    }

    return {
      todoist_task_id: data.todoist_task_id,
      urgency: data.urgency,
      importance: data.importance,
      quadrant: data.quadrant,
    };
  },

  /**
   * Deleta todas as avaliações do usuário (usado para reset).
   */
  async deleteAllRatings(): Promise<void> {
    // Como o RLS está configurado para permitir DELETE apenas se auth.uid() = user_id,
    // podemos deletar todas as linhas onde o user_id corresponde ao usuário logado.
    const { error } = await supabase
      .from('eisenhower_ratings')
      .delete()
      .neq('user_id', '00000000-0000-0000-0000-000000000000'); // Condição dummy para deletar tudo do usuário logado

    if (error) {
      console.error('Supabase Error deleting all Eisenhower ratings:', error);
      throw new Error('Falha ao deletar avaliações.');
    }
  }
};