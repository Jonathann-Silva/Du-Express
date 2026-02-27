'use server';
/**
 * @fileOverview Este arquivo implementa um fluxo Genkit para resumir as instruções de entrega do correio.
 *
 * - summarizeCourierInstructions - Uma função que resume as instruções de entrega.
 * - CourierInstructionSummarizationInput - O tipo de entrada para a função summarizeCourierInstructions.
 * - CourierInstructionSummarizationOutput - O tipo de retorno para a função summarizeCourierInstructions.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CourierInstructionSummarizationInputSchema = z.object({
  deliveryInstructions: z.string().describe('Instruções de entrega detalhadas para um entregador.'),
});
export type CourierInstructionSummarizationInput = z.infer<typeof CourierInstructionSummarizationInputSchema>;

const CourierInstructionSummarizationOutputSchema = z.object({
  summary: z.array(z.string()).describe('Uma lista de pontos-chave ou destaques das instruções de entrega.'),
});
export type CourierInstructionSummarizationOutput = z.infer<typeof CourierInstructionSummarizationOutputSchema>;

export async function summarizeCourierInstructions(input: CourierInstructionSummarizationInput): Promise<CourierInstructionSummarizationOutput> {
  return courierInstructionSummarizationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'courierInstructionSummarizationPrompt',
  input: {schema: CourierInstructionSummarizationInputSchema},
  output: {schema: CourierInstructionSummarizationOutputSchema},
  prompt: `Você é um assistente de IA para um entregador. Sua tarefa é resumir as instruções de entrega fornecidas em pontos-chave ou destaques concisos. Concentre-se em detalhes críticos como:
- Códigos de portão
- Locais de entrega específicos (por exemplo, "deixar na porta azul", "recepção")
- Solicitações de manuseio especiais (por exemplo, "frágil", "toque duas vezes")
- Números de contato, se aplicável

Não inclua saudações ou frases de conversação em sua saída. Apenas forneça os pontos-chave.

Instruções de entrega:
"""{{{deliveryInstructions}}}"""
`,
});

const courierInstructionSummarizationFlow = ai.defineFlow(
  {
    name: 'courierInstructionSummarizationFlow',
    inputSchema: CourierInstructionSummarizationInputSchema,
    outputSchema: CourierInstructionSummarizationOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
