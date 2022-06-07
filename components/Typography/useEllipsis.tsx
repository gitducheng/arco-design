import React, { useMemo, useLayoutEffect, useRef, useState, CSSProperties } from 'react';
import useUpdate from '../_util/hooks/useUpdate';
import { isNumber, isString } from '../_util/is';
import { EllipsisConfig } from './interface';

interface IEllipsis extends EllipsisConfig {
  width: number;
  renderMeasureContent: (slicedNode, isEllipsis: boolean) => React.ReactNode;
  expanding?: boolean;
  simpleEllipsis?: boolean;
}

// line-height baseline
const MEASURE_LINE_HEIGHT_TEXT = 'hxj';

enum MEASURE_STATUS {
  INIT = 0,
  MEASURING = 1,
  MEASURE_END = 2,
  NO_NEED_ELLIPSIS = 3,
}

function useEllipsis(props: React.PropsWithChildren<IEllipsis>) {
  const {
    children,
    rows = 1,
    width,
    expanding,
    renderMeasureContent,
    simpleEllipsis,
    onEllipsis,
    suffix,
    expandNodes,
    expandable,
    ellipsisStr,
  } = props;
  const singleRowNode = useRef<HTMLSpanElement>();
  const mirrorNode = useRef<HTMLSpanElement>();
  const [binarySearchIndex, setBinarySearchIndex] = useState([0, 0, 0]);
  const [lineHeight, setLineHeight] = useState(0);
  const [status, setStatus] = useState(MEASURE_STATUS.INIT);
  const [startLoc, midLoc, endLoc] = binarySearchIndex;
  const [isEllipsis, setIsEllipsis] = useState(false);

  const nodeList = useMemo(() => React.Children.toArray(children), [children]);

  useUpdate(() => {
    onEllipsis && onEllipsis(isEllipsis);
  }, [isEllipsis]);

  const isSimpleNode = (node) => {
    return isString(node) || isNumber(node);
  };

  const getTotalLen = (list: typeof nodeList) => {
    let total = 0;
    list.forEach((node) => {
      if (isSimpleNode) {
        total += String(node).length;
      } else {
        total += 1;
      }
    });
    return total;
  };

  const totalLen = useMemo(() => getTotalLen(nodeList), [nodeList]);

  const getSlicedNode = (sliceLen: number) => {
    const slicedNode: React.ReactNode[] = [];
    let currentLen = 0;
    if (sliceLen >= totalLen) {
      return nodeList;
    }
    for (const index in nodeList) {
      const node = nodeList[index];
      if (currentLen >= sliceLen) {
        return slicedNode;
      }
      const currentNodeLen = isSimpleNode(node) ? String(node).length : 1;
      if (currentNodeLen > sliceLen - currentLen) {
        slicedNode.push(String(node).slice(0, sliceLen - currentLen));
        currentLen = sliceLen;
        return slicedNode;
      }
      currentLen += currentNodeLen;
      slicedNode.push(node);
    }
    return slicedNode;
  };

  const measure = () => {
    if (lineHeight) {
      if (status === MEASURE_STATUS.INIT) {
        const maxHeight = rows * lineHeight;
        const mirrorHeight = mirrorNode.current?.offsetHeight;
        const currentEllipsis = mirrorHeight > maxHeight;
        // simpleEllipsis 和 expanding 情况下: 只用判断空间是否足够，不用计算折叠零界
        if (!currentEllipsis || simpleEllipsis || expanding) {
          setStatus(MEASURE_STATUS.MEASURE_END);
          setIsEllipsis(currentEllipsis);
          setBinarySearchIndex([0, totalLen, totalLen]);
        } else {
          setIsEllipsis(true);
          setStatus(MEASURE_STATUS.MEASURING);
        }
      } else if (status === MEASURE_STATUS.MEASURING) {
        if (startLoc !== endLoc - 1) {
          const mirrorHeight = mirrorNode.current?.offsetHeight;
          const maxHeight = rows * lineHeight;
          let nextStartLoc = startLoc;
          let nextEndLoc = endLoc;
          if (mirrorHeight <= maxHeight) {
            nextStartLoc = midLoc;
          } else {
            nextEndLoc = midLoc;
          }
          const nextMidLoc = Math.floor((nextEndLoc + nextStartLoc) / 2);
          setBinarySearchIndex([nextStartLoc, nextMidLoc, nextEndLoc]);
        } else {
          setBinarySearchIndex([startLoc, startLoc, startLoc]);
          setStatus(MEASURE_STATUS.MEASURE_END);
        }
      }
    }
  };

  useLayoutEffect(() => {
    if (props.rows) {
      setBinarySearchIndex([0, Math.floor(totalLen / 2), totalLen]);
      setStatus(MEASURE_STATUS.INIT);
    } else {
      setStatus(MEASURE_STATUS.NO_NEED_ELLIPSIS);
    }
  }, [
    totalLen,
    simpleEllipsis,
    expanding,
    width,
    suffix,
    expandNodes,
    expandable,
    ellipsisStr,
    rows,
  ]);

  useLayoutEffect(() => {
    if (singleRowNode.current && status === MEASURE_STATUS.INIT) {
      const offsetHeight = singleRowNode.current.offsetHeight;
      setLineHeight(offsetHeight);
    }
  }, [status]);

  useLayoutEffect(() => {
    measure();
  }, [status, startLoc, endLoc, lineHeight]);

  const singleRowNodeStyle: CSSProperties = {
    display: 'block',
    padding: 0,
    margin: 0,
    position: 'absolute',
    whiteSpace: 'nowrap',
    opacity: 0,
    zIndex: -999,
  };

  // 用css省略的话，需要覆盖单行省略样式
  const mirrorNodeStyle: CSSProperties = simpleEllipsis
    ? {
        textOverflow: 'clip',
        whiteSpace: 'normal',
      }
    : {};

  let ellipsisNode;
  if (status === MEASURE_STATUS.INIT) {
    ellipsisNode = (
      <>
        <span ref={singleRowNode} style={singleRowNodeStyle}>
          {MEASURE_LINE_HEIGHT_TEXT}
        </span>

        <span ref={mirrorNode} style={{ width, ...mirrorNodeStyle }}>
          {renderMeasureContent(children, isEllipsis)}
        </span>
      </>
    );
  } else if (status === MEASURE_STATUS.MEASURING) {
    ellipsisNode = (
      <span ref={mirrorNode} style={{ width, ...mirrorNodeStyle }}>
        {renderMeasureContent(getSlicedNode(midLoc), isEllipsis)}
      </span>
    );
  } else if (status === MEASURE_STATUS.MEASURE_END) {
    ellipsisNode = renderMeasureContent(getSlicedNode(midLoc), isEllipsis);
  } else if (status === MEASURE_STATUS.NO_NEED_ELLIPSIS) {
    ellipsisNode = renderMeasureContent(children, false);
  }
  return { ellipsisNode, isEllipsis };
}

export default useEllipsis;
