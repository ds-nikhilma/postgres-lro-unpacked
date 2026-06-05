import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideProps } from '../types';
import { CodeBlock } from '../components/CodeBlock';

/**
 * "How do I actually use this?" — three tabs with real-ish Go snippets:
 *   - Service handler setup (boots the gRPC LRO handler)
 *   - Request handler     (turns a gRPC call into an enqueued LRO)
 *   - Worker              (the side that actually does the work)
 *
 * Snippets are kept short on purpose — the slide is for shape, not for
 * line-by-line reading.
 */

interface Tab {
  id: string;
  label: string;
  caption: string;
  filename: string;
  highlight: number[];
  code: string;
}

const TABS: Tab[] = [
  {
    id: 'handler-setup',
    label: 'service · handler setup',
    caption: 'Wire postgres-lro into your gRPC service in ~10 lines.',
    filename: 'main.go',
    highlight: [3, 4, 5, 6, 7, 16],
    code: `func main() {
    // Set up the LRO handler:
    //   - service name (used as the queue partition key)
    //   - validator    (reject bad requests before enqueue)
    //   - unmarshaller (how to read the result back out)
    handler := lro.SetupHandler(
        "tooth-recognition",
        validateRequest,
        unmarshalResult,
    )
    handler.SetWhiteListServices(whiteListServices)

    customHandler := &customHandler{handler: handler}
    registerGrpcServer := func(s *grpc.Server) {
        toothrecognition.RegisterDSServiceServer(s, customHandler)
    }
    lro.StartLROService(registerGrpcServer, handler)
}`,
  },
  {
    id: 'request-handler',
    label: 'service · request handler',
    caption: 'One gRPC method, one Compute call. The framework takes it from there.',
    filename: 'handler.go',
    highlight: [10, 11, 12, 13, 14, 15],
    code: `func (h *customHandler) RecognizeTeeth(
    ctx context.Context,
    req *toothrecognition.RecognizeTeethRequest,
) (*longrunningpb.Operation, error) {
    anyReq, err := anypb.New(req)
    if err != nil {
        return nil, status.Errorf(codes.InvalidArgument, "marshal: %v", err)
    }

    // cache_key is the dedup signal. metadata carries trace + account.
    options := lro.ComputeOptions{
        Metadata: req.GetComputeMetadata(),
        CacheKey: computeCacheKey(req.GetCbctId()),
    }
    return h.handler.Compute(ctx, anyReq, options)
}`,
  },
  {
    id: 'worker',
    label: 'worker',
    caption: 'Workers describe one task. The framework runs claim → process → release on a loop.',
    filename: 'worker.go',
    highlight: [4, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
    code: `func main() {
    worker := newWorker()

    taskConfig := worker.ProcessWorkItemTaskConfig{
        Name: "tooth-recognition-worker",

        Run: func(ctx context.Context, c *lro.ClaimWorkItemResult) (*anypb.Any, error) {
            req := &toothrecognition.RecognizeTeethRequest{}
            c.InputData.UnmarshalTo(req)

            result, err := runModel(ctx, req.ScanId)
            if err != nil {
                return nil, fmt.Errorf("inference failed: %w", err)
            }
            return anypb.New(&toothrecognition.Response{
                Teeth:    result.Teeth,
                ResultID: result.ResultID,
            })
        },

        GetProductVersion: func(ctx context.Context) (*versioning.SemanticVersion, error) {
            v, _ := worker.computeClient.GetProductVersion(ctx)
            return &versioning.SemanticVersion{
                Major: v.GetMajor(), Minor: v.GetMinor(), Patch: v.GetPatch(),
            }, nil
        },
    }
    worker.SetupAndRunWorker(taskConfig)
}`,
  },
];

export const UsagePatternsSlide: React.FC<SlideProps> = ({ isActive }) => {
  const [tabId, setTabId] = useState(TABS[0].id);
  if (!isActive) return null;
  const tab = TABS.find(t => t.id === tabId) ?? TABS[0];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', padding: '24px 32px', gap: 16,
    }}>
      <div>
        <motion.h2
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0 }}
        >
          how to use it
          <span style={{ fontSize: 15, color: '#0f766e', marginLeft: 12, fontFamily: 'monospace', fontWeight: 600 }}>
            · three files, that's the whole service
          </span>
        </motion.h2>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 6, fontFamily: 'monospace' }}>
          {tab.caption}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {TABS.map(t => {
          const on = t.id === tabId;
          return (
            <button
              key={t.id}
              onClick={() => setTabId(t.id)}
              style={{
                padding: '9px 16px',
                background: on ? '#0f766e' : '#ffffff',
                color: on ? '#ffffff' : '#0f172a',
                border: on ? '2px solid #0f766e' : '1px solid #e2e8f0',
                borderRadius: 8,
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <CodeBlock
              code={tab.code}
              language="go"
              title={tab.filename}
              highlightLines={tab.highlight}
              fontSize={14}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{
        padding: '10px 14px',
        background: '#f0fdfa',
        border: '1px solid #5eead4',
        borderRadius: 8,
        fontSize: 13,
        color: '#115e59',
      }}>
        Highlighted lines are the only ones unique to your service — everything else is the same shape across every postgres-lro service in the fleet.
      </div>
    </div>
  );
};
