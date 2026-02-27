
'use server';
/**
 * @fileOverview Um chatbot com IA para suporte ao cliente no aplicativo de gerenciamento de entregas Lucas-Expresso.
 *
 * - clientSupportChatbot - Uma função que lida com perguntas de suporte do cliente.
 * - ClientSupportChatbotInput - O tipo de entrada para a função clientSupportChatbot.
 * - ClientSupportChatbotOutput - O tipo de retorno para a função clientSupportChatbot.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ClientSupportChatbotInputSchema = z
  .string()
  .describe('A pergunta do cliente sobre o status da entrega, preços ou políticas.');
export type ClientSupportChatbotInput = z.infer<typeof ClientSupportChatbotInputSchema>;

const ClientSupportChatbotOutputSchema = z
  .string()
  .describe('A resposta do chatbot de IA.');
export type ClientSupportChatbotOutput = z.infer<typeof ClientSupportChatbotOutputSchema>;

export async function clientSupportChatbot(
  input: ClientSupportChatbotInput
): Promise<ClientSupportChatbotOutput> {
  return clientSupportChatbotFlow(input);
}

const prompt = ai.definePrompt({
  name: 'clientSupportChatbotPrompt',
  input: {schema: ClientSupportChatbotInputSchema},
  output: {schema: ClientSupportChatbotOutputSchema},
  prompt: `Você é um chatbot de suporte com tecnologia de IA para um aplicativo de gerenciamento de entregas chamado "Lucas-Expresso".
Seu principal objetivo é ajudar os clientes com perguntas comuns relacionadas ao status da entrega, preços e políticas de serviço.
Forneça respostas claras, concisas e úteis. Se você não puder responder a uma pergunta, declare educadamente que não pode ajudar com essa consulta específica e sugira entrar em contato com o suporte humano.

Pergunta do cliente: {{{input}}}`,
});

const clientSupportChatbotFlow = ai.defineFlow(
  {
    name: 'clientSupportChatbotFlow',
    inputSchema: ClientSupportChatbotInputSchema,
    outputSchema: ClientSupportChatbotOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
