import { RealtimeItem, tool } from '@openai/agents/realtime';

const patientData = {
  "1": {
    id: 1,
    name: "John Doe",
    dob: "01/01/1975",
    pcp: "Dr. Meredith Grey",
    ehrId: "1234abcd",
    referred_providers: [
      { provider: "House, Gregory MD", specialty: "Orthopedics" },
      { specialty: "Primary Care" },
    ],
    appointments: [
      { date: "3/05/18", time: "9:15am", provider: "Dr. Meredith Grey", status: "completed" },
      { date: "8/12/24", time: "2:30pm", provider: "Dr. Gregory House", status: "completed" },
      { date: "9/17/24", time: "10:00am", provider: "Dr. Meredith Grey", status: "noshow" },
      { date: "11/25/24", time: "11:30am", provider: "Dr. Meredith Grey", status: "cancelled" }
    ]
  }
};

const hospitalInfo = `
Provider Directory
- Grey, Meredith
  - specialty: Primary Care
  - department:
    - name: Sloan Primary Care
    - address: 202 Maple St, Winston-Salem, NC 27101
    - hours: M-F 9am-5pm
- House, Gregory
  - specialty: Orthopedics
  - department:
    - name: PPTH Orthopedics
    - address: 101 Pine St, Greensboro, NC 27401
    - hours: M-W 9am-5pm
  - department:
    - name: Jefferson Hospital
    - address: 202 Maple St, Claremont, NC 28610
    - hours: Th-F 9am-5pm
- Yang, Cristina
  - specialty: Surgery
  - department:
    - name: Seattle Grace Cardiac Surgery
    - address: 456 Elm St, Charlotte, NC 28202
    - hours: M-F 9am-5pm
- Brennan, Temperance
  - specialty: Orthopedics
  - department:
    - name: Jefferson Hospital
    - address: 202 Maple St, Claremont, NC 28610
    - hours: Tu-Th 10am-4pm

Accepted Insurances:
- Medicaid
- United Health Care
- Blue Cross Blue Shield of North Carolina
- Aetna
- Cigna

Self-pay:
- Primary Care: $150
- Orthopedics: $300
- Surgery: $1000
`;


// --- Instructions and Tool Definitions ---

export const supervisorAgentInstructions = `You are an expert care coordinator supervisor agent for Kouper Health. Your role is to provide precise, real-time guidance to a junior agent who is speaking with a nurse on the phone. The nurse is booking appointments for a patient, John Doe (patient ID '1'), following a hospital visit.

# Instructions
- Your primary goal is to guide the nurse to book the correct appointments based on the patient's referrals.
- Use the provided tools to get all necessary information. Do not rely on your own knowledge.
- The junior agent will read your response verbatim, so formulate it as if you were speaking directly to the nurse.
- Be professional, concise, and clear. This is for a voice conversation.

# Core Task: Appointment Booking
To book an appointment, you must guide the junior agent to collect the following:
1. Patient Demographics: Use get_patient_details(patient_id='1') to get John Doe's info.
2. Provider/Doctor: Use the referrals from the patient details and get_hospital_information to help the nurse choose a provider.
3. Appointment Type: Determine if the appointment is 'NEW' or 'ESTABLISHED'. An appointment is 'ESTABLISHED' if the patient has seen the provider in the last 5 years. Check the patient's appointment history. A 'NEW' appointment is 30 minutes, and 'ESTABLISHED' is 15 minutes.
4. Location: Confirm the provider's location and hours using get_hospital_information.

# Answering Questions
- For provider availability: Use the 'Provider Directory' from get_hospital_information.
- For insurance questions: Use the 'Accepted Insurances' list from get_hospital_information.
- For patient history: Use the appointment history from get_patient_details.

# Tool Usage Rules
- You MUST call a tool to answer any factual question.
- If you need information from the nurse to call a tool (e.g., which referral to book first), instruct the junior agent to ask for it.
- NEVER attempt to call a tool with missing or placeholder information.

# Example Flow
1. Nurse starts conversation.
2. You use get_patient_details(patient_id='1') to get John Doe's referrals.
3. You provide a message like: "I see John Doe has referrals for Orthopedics and Primary Care. Which would you like to book first?"
4. Nurse chooses 'Orthopedics'. The referred provider is Dr. Gregory House.
5. You check John's history with Dr. House. He was seen on 8/12/24, so it's an 'ESTABLISHED' appointment.
6. You use get_hospital_information to find Dr. House's locations and hours.
7. You provide a message like: "Okay, this will be an established patient visit. Dr. House is available at PPTH Orthopedics from Monday to Wednesday, 9am to 5pm, and at Jefferson Hospital on Thursday and Friday, 9am to 5pm. Which location works?"
8. Once all details are gathered, call book_appointment.
`;

export const supervisorAgentTools = [
  {
    type: "function",
    name: "get_patient_details",
    description: "Retrieves a patient's details, including referrals and appointment history, using their unique patient ID.",
    parameters: {
      type: "object",
      properties: {
        patient_id: {
          type: "string",
          description: "The unique ID of the patient.",
        },
      },
      required: ["patient_id"],
    },
  },
  {
    type: "function",
    name: "get_hospital_information",
    description: "Retrieves general hospital information, such as provider details, accepted insurances, and appointment guidelines from the hospital data sheet.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: 'The topic to search for (e.g., "Provider Directory", "Accepted Insurances").',
        },
      },
      required: ["topic"],
    },
  },
  {
    type: "function",
    name: "book_appointment",
    description: "Books an appointment for a patient with a specific provider.",
    parameters: {
      type: "object",
      properties: {
        patient_name: { type: 'string', description: "The patient's full name." },
        provider_name: { type: 'string', description: "The provider's full name." },
        appointment_type: { type: 'string', description: 'Either NEW or ESTABLISHED.' },
        location: { type: 'string', description: 'The address of the appointment.' },
        date_time: { type: 'string', description: 'The date and time of the appointment.' },
      },
      required: ['patient_name', 'provider_name', 'appointment_type', 'location', 'date_time'],
    },
  },
];


// --- Tool Execution Logic ---

async function getToolResponse(fName: string, args: any) {
  switch (fName) {
    case "get_patient_details":
      const patientId = args.patient_id;
      if (patientData[patientId]) {
        return { success: true, data: patientData[patientId] };
      }
      return { success: false, error: 'Patient not found.' };

    case "get_hospital_information":
      return { success: true, information: hospitalInfo };

    case "book_appointment":
      console.log("Booking appointment with params:", args);
      return { success: true, confirmation_message: `Appointment confirmed for ${args.patient_name} with ${args.provider_name} at ${args.location} on ${args.date_time}.` };

    default:
      return { result: `Unknown function: ${fName}` };
  }
}


// --- API Interaction and Control Flow ---

async function fetchResponsesMessage(body: any) {
  const response = await fetch('/api/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...body, parallel_tool_calls: false }),
  });

  if (!response.ok) {
    console.warn('Server returned an error:', response);
    return { error: 'Something went wrong.' };
  }

  const completion = await response.json();
  return completion;
}

async function handleToolCalls(
  body: any,
  response: any,
  addBreadcrumb?: (title: string, data?: any) => void,
) {
  let currentResponse = response;

  while (true) {
    if (currentResponse?.error) {
      return { error: 'Something went wrong.' } as any;
    }

    const outputItems: any[] = currentResponse.output ?? [];
    const functionCalls = outputItems.filter((item) => item.type === 'function_call');

    if (functionCalls.length === 0) {
      const assistantMessages = outputItems.filter((item) => item.type === 'message');
      const finalText = assistantMessages
        .map((msg: any) => {
          const contentArr = msg.content ?? [];
          return contentArr
            .filter((c: any) => c.type === 'output_text')
            .map((c: any) => c.text)
            .join('');
        })
        .join('\n');
      return finalText;
    }

    for (const toolCall of functionCalls) {
      const fName = toolCall.name;
      const args = JSON.parse(toolCall.arguments || '{}');
      const toolRes = await getToolResponse(fName, args);

      if (addBreadcrumb) {
        addBreadcrumb(`[supervisorAgent] function call: ${fName}`, args);
        addBreadcrumb(`[supervisorAgent] function call result: ${fName}`, toolRes);
      }

      body.input.push(
        {
          type: 'function_call',
          call_id: toolCall.call_id,
          name: toolCall.name,
          arguments: toolCall.arguments,
        },
        {
          type: 'function_call_output',
          call_id: toolCall.call_id,
          output: JSON.stringify(toolRes),
        },
      );
    }

    currentResponse = await fetchResponsesMessage(body);
  }
}

export const getNextResponseFromSupervisor = tool({
  name: 'getNextResponseFromSupervisor',
  description:
    'Determines the next response whenever the agent faces a non-trivial decision, produced by a highly intelligent supervisor agent. Returns a message describing what to do next.',
  parameters: {
    type: 'object',
    properties: {
      relevantContextFromLastUserMessage: {
        type: 'string',
        description:
          'Key information from the user described in their most recent message. This is critical to provide as the supervisor agent with full context as the last message might not be available. Okay to omit if the user message didn\'t add any new information.',
      },
    },
    required: ['relevantContextFromLastUserMessage'],
    additionalProperties: false,
  },
  execute: async (input, details) => {
    const { relevantContextFromLastUserMessage } = input as {
      relevantContextFromLastUserMessage: string;
    };

    const addBreadcrumb = (details?.context as any)?.addTranscriptBreadcrumb as
      | ((title: string, data?: any) => void)
      | undefined;

    const history: RealtimeItem[] = (details?.context as any)?.history ?? [];
    const filteredLogs = history.filter((log) => log.type === 'message');

    const body: any = {
      model: 'gpt-4.1',
      input: [
        {
          type: 'message',
          role: 'system',
          content: supervisorAgentInstructions,
        },
        {
          type: 'message',
          role: 'user',
          content: `==== Conversation History ====
          ${JSON.stringify(filteredLogs, null, 2)}
          
          ==== Relevant Context From Last User Message ===
          ${relevantContextFromLastUserMessage}
          `,
        },
      ],
      tools: supervisorAgentTools,
    };

    const response = await fetchResponsesMessage(body);
    if (response.error) {
      return { error: 'Something went wrong.' };
    }

    const finalText = await handleToolCalls(body, response, addBreadcrumb);
    if ((finalText as any)?.error) {
      return { error: 'Something went wrong.' };
    }

    return { nextResponse: finalText as string };
  },
});