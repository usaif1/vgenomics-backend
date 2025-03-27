import sys
import json

if len(sys.argv) > 1:
    try:
        data = json.loads(sys.argv[1])
        a = data['a']
        b = data['b']
        print(json.dumps({
            "sum": a + b,
            "difference": a - b,
            "product": a * b
        }))
    except Exception as e:
        print(f"Error: {str(e)}")
else:
    print("No arguments provided")