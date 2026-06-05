import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { SlideProps } from '../types';
import { CodeBlock } from '../components/CodeBlock';

const serviceCode = `// main.go — Setting up an LRO service
func main() {
    handler := lro.SetupHandler(
        "my-compute-service",
        validateRequest,   // your validation func
        unmarshalResult,   // your result unmarshaler
    )

    // Optional: add hooks for custom logic
    handler.SetHooks(&lro.HandlerHooks{
        OnBeforeReleaseOnSuccess: checkResultQuality,
        OnAfterReleaseOnSuccess:  notifyDownstream,
    })

    // Optional: enable caching & storage cleanup
    handler.SetExtractExternalRefs(extractInputGrids)
    handler.SetStorageNotificationsListener()

    // Register with your gRPC server
    pb.RegisterOperationsServer(grpcServer, handler)
}`;

const workerCode = `// main.go — Setting up a worker
func main() {
    worker.SetupAndRunWorker(worker.ProcessWorkItemTaskConfig{
        Name: "my-compute-worker",

        // This is YOUR compute logic
        Run: func(ctx context.Context,
            item *pb.ClaimWorkItemResult,
        ) (*anypb.Any, error) {
            // 1. Unmarshal input
            input := &pb.MyComputeRequest{}
            item.InputData.UnmarshalTo(input)

            // 2. Do your computation
            result := doHeavyComputation(ctx, input)

            // 3. Return result (framework handles the rest)
            return anypb.New(result)
        },

        // Optional: readiness check
        ComputeReadinessCheck: func() error {
            return checkGPUAvailable()
        },
    })
}`;

const clientCode = `// Calling the LRO service from a client
func ComputeAndWait(ctx context.Context) (*pb.Result, error) {
    // 1. Submit the compute request
    op, err := client.Compute(ctx, &pb.ComputeRequest{
        Input: myInput,
    })

    // 2. Wait for completion (polls every 1s)
    op, err = client.WaitOperation(ctx, &longrunning.WaitOperationRequest{
        Name:    op.Name,
        Timeout: durationpb.New(5 * time.Minute),
    })

    // 3. Extract result
    if op.Done {
        result := &pb.Result{}
        op.GetResponse().UnmarshalTo(result)
        return result, nil
    }
    return nil, fmt.Errorf("operation timed out")
}`;

const envVarsCode = `# Service configuration (env vars)
POSTGRES_HOST=localhost
POSTGRES_DB=my_lro_db
MAX_CLAIM_RETRIES=3
CLEANUP_INTERVAL=60s
DEFAULT_LRO_LIFETIME=24h
WORKER_VERSION_TTL=15s

# Worker configuration (env vars)
LRO_NAME=my-compute-service
CLAIM_DURATION_SECONDS=300
CLAIM_RENEWAL_SECONDS=150
MAX_CONCURRENCY=4
POD_NAME=worker-pod-7x9k`;

const tabs = [
  { label: 'Service Setup', code: serviceCode, lang: 'go', title: 'lro-service/main.go' },
  { label: 'Worker Setup', code: workerCode, lang: 'go', title: 'worker/main.go' },
  { label: 'Client Usage', code: clientCode, lang: 'go', title: 'client/compute.go' },
  { label: 'Configuration', code: envVarsCode, lang: 'bash', title: '.env' },
];

export const ConsumerAPISlide: React.FC<SlideProps> = ({ isActive }) => {
  const [activeTab, setActiveTab] = useState(0);

  if (!isActive) return null;

  const tab = tabs[activeTab];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '40px 60px',
      gap: 20,
    }}>
      <motion.h2
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        style={{ fontSize: 32, fontWeight: 700, color: '#e2e8f0' }}
      >
        How to Use It
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{ fontSize: 15, color: '#94a3b8', margin: 0 }}
      >
        Three integration points: set up the <strong style={{ color: '#3b82f6' }}>service</strong>,
        implement the <strong style={{ color: '#f43f5e' }}>worker</strong>,
        and call it from your <strong style={{ color: '#22c55e' }}>client</strong>.
      </motion.p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {tabs.map((t, i) => (
          <motion.button
            key={i}
            onClick={() => setActiveTab(i)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: i === activeTab ? '2px solid #3b82f6' : '1px solid #334155',
              background: i === activeTab ? '#3b82f620' : '#1e293b',
              color: i === activeTab ? '#93c5fd' : '#94a3b8',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            {t.label}
          </motion.button>
        ))}
      </div>

      {/* Code */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <CodeBlock
          code={tab.code}
          language={tab.lang}
          title={tab.title}
          fontSize={12}
        />
      </div>

      {activeTab === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: '10px 20px',
            background: '#3b82f610',
            border: '1px solid #3b82f630',
            borderRadius: 8,
            fontSize: 13,
            color: '#93c5fd',
          }}
        >
          The framework handles: database setup, claim management, cleanup routines, version resolution, auth, and metrics.
          You just provide validation + result unmarshaling.
        </motion.div>
      )}
      {activeTab === 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: '10px 20px',
            background: '#f43f5e10',
            border: '1px solid #f43f5e30',
            borderRadius: 8,
            fontSize: 13,
            color: '#fda4af',
          }}
        >
          The worker handles: polling loop, claim renewal, concurrency, error reporting, graceful shutdown.
          You just implement the Run function.
        </motion.div>
      )}
    </div>
  );
};
